import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { forwardRef, Inject } from '@nestjs/common';
import { OrderService } from './order.service';
import { RedisService } from 'src/redis-cache/redis-cache.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class OrderGateway {
  @WebSocketServer()
  server: Server;

  constructor(
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
    private readonly redis: RedisService,
  ) {}

  // 🔧 HÀM LỌC QUANTITY > 0
  private sanitizeOrder(orderItems: any[]) {
    if (!Array.isArray(orderItems)) return [];
    return orderItems
      .filter((item) => item.quantity > 0)
      .map((item) => ({
        ...item,
        quantity: Number(item.quantity || 0),
      }));
  }

  // 🪑 Khi user join bàn
  @SubscribeMessage('joinTable')
  async handleJoinTable(
    @MessageBody() data: { tableId: string; tableNumber: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { tableId, tableNumber } = data;
    client.join(`table_${tableNumber}`);

    const redisKey = `table_${tableNumber}`;
    const redisFirstKey = `first_order_${tableNumber}`;

    let currentOrder = await this.redis.get(redisKey);

    const dbOrder = await this.orderService.getOrderByTable(tableId);
    const currentOrderProcessing = dbOrder?.progressStatus;

    if (!currentOrder) {
      currentOrder = { orderItems: [], totalPrice: 0 };
      await this.redis.set(redisKey, currentOrder, 7200);
    }

    const firstOrder = await this.redis.get(redisFirstKey);

    if (!firstOrder && dbOrder) {
      await this.redis.set(redisFirstKey, currentOrder, 7200);
    }

    client.emit('currentOrder', currentOrder);
    client.emit('currentOrderProcessing', currentOrderProcessing);
    client.emit('firstOrder', firstOrder || null);
  }

  // 🔄 FE thay đổi order (chưa gửi)
  @SubscribeMessage('updateOrder')
  async handleUpdateOrder(
    @MessageBody()
    data: {
      updateOrder: any[];
      totalPrice: number;
      tableNumber: string;
    },
  ) {
    const { updateOrder: orderItems, totalPrice, tableNumber } = data;

    const redisKey = `table_${tableNumber}`;

    // ✔ Lọc quantity > 0
    const cleanOrderItems = this.sanitizeOrder(orderItems);

    // FE có thể gửi rỗng, nhưng backend vẫn giữ object hợp lệ
    const updatedOrder = {
      orderItems: cleanOrderItems,
      totalPrice: cleanOrderItems.length === 0 ? 0 : totalPrice,
    };

    await this.redis.set(redisKey, updatedOrder, 7200);

    this.server.to(`table_${tableNumber}`).emit('orderUpdated', updatedOrder);
  }

  // 📤 Khách gửi order
  @SubscribeMessage('sendOrder')
  async handleSendOrder(
    @MessageBody()
    data: {
      currentOrderId: string;
      orderItems: any[];
      totalPrice: number;
      tableNumber: string;
      statusChanged: string;
      isAddItems: boolean;
    },
  ) {
    const {
      currentOrderId,
      orderItems,
      totalPrice,
      tableNumber,
      statusChanged,
      isAddItems,
    } = data;

    const redisKey = `table_${tableNumber}`;
    const redisFirstKey = `first_order_${tableNumber}`;

    // ✔ Lọc quantity > 0 trước khi xử lý DB
    const cleanOrderItems = this.sanitizeOrder(orderItems);

    if (isAddItems) {
      const firstOrder = (await this.redis.get(redisFirstKey)) || {
        orderItems: [],
        totalPrice: 0,
      };

      const updatedOrder = {
        orderItems: [...firstOrder.orderItems, ...cleanOrderItems],
        totalPrice: firstOrder.totalPrice + totalPrice,
      };

      console.log('🔹 Thêm món:', updatedOrder);
    } else {
      // 🚀 Gửi order lần đầu
      await this.emitOrderStatusChanged(tableNumber, statusChanged);

      await this.orderService.update(currentOrderId, {
        orderItems: cleanOrderItems,
        totalPrice,
        progressStatus: statusChanged,
        paymentStatus: 'unpaid',
      });

      await this.redis.set(redisFirstKey, {
        orderItems: cleanOrderItems,
        totalPrice,
      });

      await this.redis.set(redisKey, {
        orderItems: cleanOrderItems,
        totalPrice,
      });

      this.server
        .to(`table_${tableNumber}`)
        .emit('firstOrder', { orderItems: cleanOrderItems, totalPrice });

      // FE reset
      await this.redis.set(redisKey, { orderItems: [], totalPrice: 0 });
      this.server
        .to(`table_${tableNumber}`)
        .emit('orderUpdated', { orderItems: [], totalPrice: 0 });
    }
  }

  @SubscribeMessage('orderPaid')
  async handleOrderPaid(@MessageBody() orderId: string) {
    const { order, table } = await this.orderService.markOrderPaid(orderId);

    this.server.to(`table_${order.tableId}`).emit('orderStatusChanged', order);
    this.server.to(`table_${order.tableId}`).emit('tableStatusChanged', table);
  }

  @SubscribeMessage('leaveTable')
  handleLeaveTable(
    @MessageBody() tableId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`table_${tableId}`);
  }

  async emitOrderUpdate(tableId: string, order: any) {
    this.server.to(`table_${tableId}`).emit('orderUpdatedRealtime', order);
  }

  async emitTableUpdate(tableId: string, table: any) {
    this.server.to(`table_${tableId}`).emit('tableUpdatedRealtime', table);
  }

  async emitOrderStatusChanged(tableNumber: string, status: string) {
    this.server.to(`table_${tableNumber}`).emit('orderStatusChanged', status);
  }
}
