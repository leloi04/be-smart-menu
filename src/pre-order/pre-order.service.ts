import { Injectable } from '@nestjs/common';
import { CreatePreOrderDto } from './dto/create-pre-order.dto';
import { UpdatePreOrderDto } from './dto/update-pre-order.dto';
import { InjectModel } from '@nestjs/mongoose';
import { PreOrder, PreOrderDocument } from './schemas/pre-order.schema';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { IUser } from 'src/types/global.constanst';
import aqp from 'api-query-params';
import { User, UserDocument } from 'src/users/schemas/user.schema';
import { PreOrderGateway } from './pre-order.gateway';
import { RedisService } from 'src/redis-cache/redis-cache.service';

@Injectable()
export class PreOrderService {
  constructor(
    @InjectModel(PreOrder.name)
    private PreOrderModel: SoftDeleteModel<PreOrderDocument>,
    @InjectModel(User.name)
    private UserModel: SoftDeleteModel<UserDocument>,
    private readonly preOrderGateway: PreOrderGateway,
    private readonly redis: RedisService,
  ) {}

  async create(createPreOrderDto: CreatePreOrderDto, user: IUser) {
    const {
      customerId,
      payment,
      method,
      deliveryAddress,
      note,
      pickupTime,
      orderItems,
      totalItemPrice,
      totalPayment,
    } = createPreOrderDto;
    const dataUser = await this.UserModel.findById(customerId).select([
      'name',
      '_id',
    ]);
    const newPreOrder = await this.PreOrderModel.create({
      ...createPreOrderDto,
      createdBy: {
        _id: user._id,
        email: user.email,
      },
    });
    const data = {
      dataUser,
      orderItems,
      deliveryAddress: deliveryAddress ?? deliveryAddress,
      pickupTime: pickupTime ?? pickupTime,
      note,
      method,
      id: newPreOrder?._id,
      totalItemPrice,
      totalPayment,
    };

    await this.preOrderGateway.handleSendPreOrder(data);
  }

  async findAll(currentPage: number, limit: number, qs: string) {
    const { filter, sort, projection, population } = aqp(qs);
    delete filter.current;
    delete filter.pageSize;
    let offset = (currentPage - 1) * +limit;
    let defaultLimit = limit ? limit : 10;
    const totalItems = (await this.PreOrderModel.find(filter)).length;
    const totalPages = Math.ceil(totalItems / defaultLimit);
    const result = await this.PreOrderModel.find(filter)
      .skip(offset)
      .limit(defaultLimit)
      // @ts-ignore: Unreachable code error
      .sort(sort as any)
      .populate(population)
      .exec();

    return {
      meta: {
        current: currentPage, //trang hiện tại
        pageSize: limit, //số lượng bản ghi đã lấy
        pages: totalPages, //tổng số trang với điều kiện query
        total: totalItems, // tổng số phần tử (số bản ghi)
      },
      result, //kết quả query
    };
  }

  async findOne(id: string) {
    return await this.PreOrderModel.findById(id).populate({
      path: 'customerId',
      select: 'name email phone _id',
    });
  }

  async update(id: string, updatePreOrderDto: UpdatePreOrderDto, user: IUser) {
    return this.PreOrderModel.updateOne(
      { _id: id },
      {
        ...updatePreOrderDto,
        updatedBy: {
          _id: user._id,
          email: user.email,
        },
      },
    );
  }

  async remove(id: string, user: IUser) {
    await this.PreOrderModel.updateOne(
      { _id: id },
      {
        deletedBy: {
          _id: user._id,
          email: user.email,
        },
      },
    );
    return await this.PreOrderModel.softDelete({ _id: id });
  }

  async pushTracking(orderId: string, tracking: any) {
    return this.PreOrderModel.updateOne(
      { _id: orderId },
      {
        $push: { tracking },
      },
    );
  }

  async fetchPreOrderDelivery() {
    const data = await this.PreOrderModel.find({
      deliveryAddress: { $ne: null },
      tracking: {
        $elemMatch: {
          status: 'ready',
        },
      },
    }).populate({ path: 'customerId', select: 'name email phone _id' });

    const dataDelivery = data.map((item) => {
      const dataCustomer = item.customerId as any;
      return {
        id: item._id,
        customerName: dataCustomer?.name,
        phone: dataCustomer?.phone,
        orderItems: item.orderItems,
        totalPayment: item.totalPayment,
        deliveryAddress: item.deliveryAddress,
        timestamp: item.tracking.find((t) => t.status === 'ready')?.timestamp,
        note: item.note || '',
      };
    });

    return dataDelivery;
  }

  async fetchPreOrderUncompleted(user: IUser) {
    const data = await this.PreOrderModel.aggregate([
      {
        $match: {
          customerId: user._id,
        },
      },
      {
        $match: {
          $expr: {
            $not: {
              $in: [
                { $arrayElemAt: ['$tracking.status', -1] },
                ['completed', 'cancelled'],
              ],
            },
          },
        },
      },
      {
        $sort: { createdAt: -1 },
      },
    ]);

    return data;
  }

  async fetchPreOrderCompleted(user: IUser) {
    const data = await this.PreOrderModel.find({
      customerId: user._id,
      tracking: {
        $elemMatch: { status: 'completed' },
      },
    });

    return data;
  }

  async fetchPreOrderCancelled(user: IUser) {
    const data = await this.PreOrderModel.find({
      customerId: user._id,
      tracking: {
        $elemMatch: { status: 'cancelled' },
      },
    });

    return data;
  }

  async completePreOrder(id: string) {
    await this.preOrderGateway.handleCompletePreOrder(id);
  }

  async summaryPreOrder(month: string, year: string) {
    const startDate = new Date(Number(year), Number(month) - 1, 1);
    const endDate = new Date(Number(year), Number(month), 1);

    const result = await this.PreOrderModel.aggregate([
      {
        $match: {
          isDeleted: false,
          createdAt: {
            $gte: startDate,
            $lt: endDate,
          },
        },
      },
      {
        $addFields: {
          hasCompleted: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: '$tracking',
                    as: 't',
                    cond: { $eq: ['$$t.status', 'completed'] },
                  },
                },
              },
              0,
            ],
          },
        },
      },
      {
        $group: {
          _id: null,

          totalOrders: { $sum: 1 },

          totalRevenue: { $sum: '$totalPayment' },

          paidOrders: {
            $sum: {
              $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0],
            },
          },

          unpaidOrders: {
            $sum: {
              $cond: [{ $eq: ['$paymentStatus', 'unpaid'] }, 1, 0],
            },
          },

          paidRevenue: {
            $sum: {
              $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$totalPayment', 0],
            },
          },

          unpaidRevenue: {
            $sum: {
              $cond: [
                { $eq: ['$paymentStatus', 'unpaid'] },
                '$totalPayment',
                0,
              ],
            },
          },

          completedOrders: {
            $sum: {
              $cond: ['$hasCompleted', 1, 0],
            },
          },

          processingOrders: {
            $sum: {
              $cond: ['$hasCompleted', 0, 1],
            },
          },
        },
      },
    ]);

    return (
      result[0] || {
        totalOrders: 0,
        totalRevenue: 0,
        paidOrders: 0,
        unpaidOrders: 0,
        paidRevenue: 0,
        unpaidRevenue: 0,
        completedOrders: 0,
        processingOrders: 0,
      }
    );
  }

  async summaryOrderForOnline(year: string) {
    const startDate = new Date(Number(year), 0, 1);
    const endDate = new Date(Number(year) + 1, 0, 1);

    const result = await this.PreOrderModel.aggregate([
      {
        $match: {
          isDeleted: false,
          createdAt: {
            $gte: startDate,
            $lt: endDate,
          },
        },
      },
      {
        $group: {
          _id: { $month: '$createdAt' }, // 1 -> 12
          totalOrders: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          month: '$_id',
          totalOrders: 1,
        },
      },
      {
        $sort: { month: 1 },
      },
    ]);

    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const found = result.find((r) => r.month === month);
      return {
        month,
        totalOrders: found ? found.totalOrders : 0,
      };
    });

    return monthlyData;
  }

  async topItems(month: string, year: string) {
    const startDate = new Date(Number(year), Number(month) - 1, 1);
    const endDate = new Date(Number(year), Number(month), 1);

    const result = await this.PreOrderModel.aggregate([
      {
        $match: {
          isDeleted: false,
          createdAt: {
            $gte: startDate,
            $lt: endDate,
          },
        },
      },

      {
        $unwind: '$orderItems',
      },

      {
        $group: {
          _id: '$orderItems.menuItemId',
          name: { $first: '$orderItems.name' },
          quantity: { $sum: '$orderItems.quantity' },
        },
      },

      {
        $project: {
          _id: 0,
          menuItemId: '$_id',
          name: 1,
          quantity: 1,
        },
      },
    ]);

    return result;
  }
}
