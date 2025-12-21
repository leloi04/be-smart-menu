import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Inject, forwardRef } from '@nestjs/common';
import { RedisService } from 'src/redis-cache/redis-cache.service';
import { PreOrderService } from './pre-order.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class PreOrderGateway {
  @WebSocketServer()
  server: Server;

  constructor(
    @Inject(forwardRef(() => PreOrderService))
    private readonly preOrderService: PreOrderService,
    private readonly redis: RedisService,
  ) {}

  // 🔔 Khi user đặt preorder
  async handleSendPreOrder(data: any) {
    const {
      dataUser,
      orderItems,
      deliveryAddress,
      pickupTime,
      note,
      method,
      id,
      totalItemPrice,
      totalPayment,
    } = data;
    const keyItems = `pre-order:${id}`;
    const notificationKey = 'notification_pre-order';

    // lưu thông tin món của khách
    await this.redis.set(keyItems, { orderItems }, 86400);

    // // Lưu redis cho staff xem
    const existingNotifications = (await this.redis.get(notificationKey)) || [];
    const newOrderNotification = {
      keyRedis: keyItems,
      id,
      dataUser,
      orderItems,
      deliveryAddress,
      pickupTime,
      note,
      method,
      timestamp: new Date().toISOString(),
    };
    await this.redis.set(notificationKey, [
      ...existingNotifications,
      newOrderNotification,
    ]);

    this.server.to('staff_room').emit('newOrderPreOrder', newOrderNotification);
  }
}
