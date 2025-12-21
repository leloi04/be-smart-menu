import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import aqp from 'api-query-params';
import { Order, OrderDocument } from './schemas/order.schema';
import { Table, TableDocument } from 'src/table/schemas/table.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { IUser } from 'src/types/global.constanst';
import { OrderGateway } from './order.gateway';
import { RedisService } from 'src/redis-cache/redis-cache.service';

@Injectable()
export class OrderService {
  constructor(
    @InjectModel(Order.name)
    private OrderModel: SoftDeleteModel<OrderDocument>,
    @InjectModel(Table.name)
    private TableModel: SoftDeleteModel<TableDocument>,
    private readonly orderGateway: OrderGateway,
    private readonly redis: RedisService,
  ) {}

  // 🧾 Tạo order (REST API hoặc Socket)
  async create(createOrderDto: CreateOrderDto) {
    const newOrder = await this.OrderModel.create({
      ...createOrderDto,
      progressStatus: createOrderDto['progressStatus'] || 'draft',
      paymentStatus: createOrderDto['paymentStatus'] || 'unpaid',
    });

    // Cập nhật trạng thái bàn sang occupied
    await this.TableModel.findByIdAndUpdate(newOrder.tableId, {
      currentOrder: newOrder._id,
      status: 'occupied',
    });

    // Phát realtime đến client trong bàn
    await this.orderGateway.emitOrderUpdate(
      newOrder.tableId.toString(),
      newOrder,
    );

    return newOrder;
  }

  // 🔍 Lấy danh sách order có phân trang
  async findAll(currentPage: number, limit: number, qs: string) {
    const { filter, sort, projection, population } = aqp(qs);
    delete filter.current;
    delete filter.pageSize;

    const offset = (currentPage - 1) * +limit;
    const defaultLimit = limit ? limit : 10;
    const totalItems = await this.OrderModel.countDocuments(filter);
    const totalPages = Math.ceil(totalItems / defaultLimit);

    const result = await this.OrderModel.find(filter)
      .skip(offset)
      .limit(defaultLimit)
      // @ts-ignore
      .sort(sort as any)
      .populate(population)
      .exec();

    return {
      meta: {
        current: currentPage,
        pageSize: limit,
        pages: totalPages,
        total: totalItems,
      },
      result,
    };
  }

  // 🔍 Lấy 1 order
  async findOne(id: string) {
    const order = await this.OrderModel.findById(id);
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  // ✏️ Cập nhật order
  async update(id: string, updateOrderDto: UpdateOrderDto) {
    const updatedOrder = await this.OrderModel.findByIdAndUpdate(
      id,
      { ...updateOrderDto },
      { new: true },
    );
    if (!updatedOrder) throw new NotFoundException('Order not found');

    await this.orderGateway.emitOrderUpdate(
      updatedOrder.tableId.toString(),
      updatedOrder,
    );

    return updatedOrder;
  }

  // 🗑️ Xóa mềm order
  async remove(id: string, user: IUser) {
    await this.OrderModel.updateOne(
      { _id: id },
      { deletedBy: { _id: user._id, email: user.email } },
    );
    return await this.OrderModel.softDelete({ _id: id });
  }

  // 🧾 Lấy order hiện tại theo bàn
  async getCurrentOrderByTable(tableId: string) {
    return this.OrderModel.findOne({
      tableId,
      paymentStatus: { $ne: 'unpaid' },
    });
  }

  // 📦 Lấy order mới nhất theo bàn
  async getOrderByTable(tableId: string) {
    return this.OrderModel.findOne({
      tableId,
      paymentStatus: 'unpaid',
    })
      .sort({ createdAt: -1 })
      .lean();
  }

  // update OrderItems of order
  async updateOrderItems(id: string, orderItems: any, priceOrder: any) {
    const order = (await this.OrderModel.findById(id)) as any;
    const totalPrice = order.totalPrice;
    const totalPriceUpdate = totalPrice + priceOrder;
    const orderItemsCurrent = order.orderItems;
    const orderItemsUpdate = [...orderItemsCurrent, ...orderItems];
    return this.OrderModel.findByIdAndUpdate(
      id,
      {
        orderItems: orderItemsUpdate,
        totalPrice: totalPriceUpdate,
      },
      { new: true },
    );
  }

  // 🔁 Cập nhật status order theo bàn
  async updateStatusByTable(tableId: string, update: any) {
    const updatedOrder = await this.OrderModel.findOneAndUpdate(
      { tableId },
      { $set: update },
      { new: true },
    ).lean();

    if (updatedOrder)
      await this.orderGateway.emitOrderUpdate(tableId, updatedOrder);

    return updatedOrder;
  }

  // 💰 Thanh toán
  async markOrderPaid(orderId: string) {
    const order = await this.OrderModel.findByIdAndUpdate(
      orderId,
      { paymentStatus: 'paid' },
      { new: true },
    );
    if (!order) throw new NotFoundException('Order not found');

    const table = await this.TableModel.findByIdAndUpdate(
      order.tableId,
      { status: 'cleaning' },
      { new: true },
    );

    return { order, table };
  }

  // ➕ Thêm khách hàng vào order
  async addCustomerToOrder(orderId: string, customer: any) {
    const order = await this.OrderModel.findById(orderId);
    if (!order) throw new BadRequestException('Order not found');

    const exists = order.customers.some((c) =>
      c.isGuest
        ? c.userId === customer.userId // khách vãng lai, check uuid tạm
        : c.userId?.toString() === customer.userId?.toString(),
    );

    const table = await this.TableModel.findById(order.tableId);
    if (table) {
      const seats = table.seats;
      if (order.customers.length >= seats && !exists) {
        throw new BadRequestException(
          `Số khách đã đạt tối đa của bàn ( ${seats} khách )`,
        );
      }
    }

    if (!exists) {
      order.customers.push({
        userId: customer.userId || null,
        name: customer.name,
        isGuest: customer.isGuest,
      });
      await order.save();
    }

    return order;
  }

  async completedOrder(tableNumber: any) {
    const table = await this.TableModel.findOne({ tableNumber });
    if (table) {
      await this.OrderModel.findByIdAndUpdate(
        table.currentOrder,
        { progressStatus: 'completed' },
        { new: true },
      );
    }
  }

  async changedStatus(
    dataSet: { tableNumber?: string; customerName?: string },
    orderId: string,
    status: string,
    keyRedis: string,
    batchId?: string,
  ) {
    const { customerName, tableNumber } = dataSet;
    if (tableNumber) {
      switch (status) {
        case 'draft':
          await this.redis.del(keyRedis);
          this.orderGateway.server
            .to(`table_${tableNumber}`)
            .emit('firstOrder', { orderItems: [], totalPrice: 0 });
          await this.OrderModel.findByIdAndUpdate(
            orderId,
            {
              totalPrice: 0,
              orderItems: [],
              progressStatus: status,
            },
            { new: true },
          );
          await this.orderGateway.emitOrderStatusChanged(tableNumber, status);

          break;
        case 'only-processing':
          await this.OrderModel.findByIdAndUpdate(
            orderId,
            {
              progressStatus: 'processing',
            },
            { new: true },
          );
          await this.orderGateway.emitOrderStatusChanged(
            tableNumber,
            'processing',
          );
          break;
        case 'pending_confirmation':
          await this.OrderModel.findByIdAndUpdate(
            orderId,
            {
              progressStatus: 'pending_confirmation',
            },
            { new: true },
          );
          break;
        case 'processing':
          if (batchId) {
            const order = (await this.redis.get(keyRedis)).find(
              (i) => batchId === i.batchId,
            );
            if (!order) {
              throw new NotFoundException('Order not found in Redis');
            }
            const totalItems = order.orderItems.length || 0;
            await this.orderGateway.processOrderItems({
              orderItems: order.orderItems,
              tableNumber,
              dataKey: keyRedis,
              batchId,
            });
            await this.OrderModel.findByIdAndUpdate(
              orderId,
              { progressStatus: status },
              { new: true },
            );
            await this.orderGateway.handleDataTable(
              tableNumber,
              totalItems,
              [],
            );
          } else {
            const order = await this.redis.get(keyRedis);
            if (!order) {
              throw new NotFoundException('Order not found in Redis');
            }
            const totalItems = order.orderItems.length || 0;
            await this.orderGateway.processOrderItems({
              orderItems: order.orderItems,
              tableNumber,
              dataKey: keyRedis,
            });
            await this.OrderModel.findByIdAndUpdate(
              orderId,
              { progressStatus: status },
              { new: true },
            );
            await this.orderGateway.handleDataTable(
              tableNumber,
              totalItems,
              [],
            );
          }
          await this.orderGateway.emitOrderStatusChanged(tableNumber, status);

          break;
        case 'completed':
          break;
        default:
          throw new BadRequestException('Invalid status value');
      }
    }

    if (customerName) {
      switch (status) {
        case 'draft':
          break;
        case 'pending_confirmation':
          break;
        case 'processing':
          const order = await this.redis.get(keyRedis);
          if (!order) {
            throw new NotFoundException('Order not found in Redis');
          }
          const totalItems = order.orderItems.length || 0;
          await this.orderGateway.processOrderItems({
            orderItems: order.orderItems,
            customerName,
            dataKey: keyRedis,
          });
          await this.orderGateway.handleDataOnline(
            orderId,
            customerName,
            totalItems,
            order.orderItems,
            [],
          );
          break;
        case 'completed':
          break;
        default:
          throw new BadRequestException('Invalid status value');
      }
    }
  }
}
