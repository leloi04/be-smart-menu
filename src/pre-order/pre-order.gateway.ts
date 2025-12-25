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
import { PRE_ORDER_STATUS } from 'src/types/global.constanst';
import { OrderGateway } from 'src/order/order.gateway';

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
    @Inject(forwardRef(() => OrderGateway))
    private readonly orderGateway: OrderGateway,
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
    const keyTracking = `pre-order:tracking:${id}`;
    const notificationKey = 'notification_pre-order';

    // lưu thông tin món của khách
    await this.redis.set(keyItems, { orderItems }, 86400);

    // lưu thông tin tracking đơn hàng
    await this.redis.set(
      keyTracking,
      {
        tracking: [{ status: PRE_ORDER_STATUS.PENDING, timestamp: new Date() }],
      },
      86400,
    );

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

  // 🔔 Khi khách hủy đơn
  @SubscribeMessage('cancelPreOrder')
  async handleCancelPreOrder(
    @MessageBody() data: { orderId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { orderId } = data;

    const trackingKey = `pre-order:tracking:${orderId}`;

    const tracking = (await this.redis.get(trackingKey)) || [];

    const cancelTracking = {
      status: PRE_ORDER_STATUS.CANCELLED,
      timestamp: new Date(),
    };

    tracking.tracking.push(cancelTracking);

    // Redis
    await this.redis.set(trackingKey, tracking, 86400);

    // DB
    await this.preOrderService.pushTracking(orderId, cancelTracking);
  }

  // 🔔 Khi đơn hoàn thành
  async handleCompletePreOrder(orderId: string) {
    const keyNotify = 'data_pre-order';
    const trackingKey = `pre-order:tracking:${orderId}`;
    const tracking = (await this.redis.get(trackingKey)) || [];

    const completedTracking = {
      status: PRE_ORDER_STATUS.COMPLETED,
      timestamp: new Date(),
    };

    tracking.tracking.push(completedTracking);

    // Redis
    await this.redis.set(trackingKey, tracking, 86400);

    const dataNotify = (await this.redis.get(keyNotify)) || [];
    const dataNotifyUpdate = dataNotify.filter((d) => d.id !== orderId);

    await this.redis.set(keyNotify, dataNotifyUpdate);

    this.server.to('staff_room').emit('dataPreOrder', dataNotifyUpdate);

    // DB
    await this.preOrderService.pushTracking(orderId, completedTracking);
  }

  // 🔔 Khi nhân viên xác nhận đơn
  @SubscribeMessage('handleConfirmNotifyPreOrder')
  async handleConfirmNotify(
    @MessageBody()
    dataConfirm: {
      id: string;
      key: string;
      orderItems: any;
      customerName: string;
    },
  ) {
    const { id, key, orderItems, customerName } = dataConfirm;
    const keyTracking = `pre-order:tracking:${id}`;
    const keyNotification = 'notification_pre-order';
    const confirmTracking = {
      status: PRE_ORDER_STATUS.CONFIRMED,
      timestamp: new Date(),
    };
    const prepareTracking = {
      status: PRE_ORDER_STATUS.PREPARING,
      timestamp: new Date(),
    };

    const OrderItems = orderItems.map((o) => ({
      menuItemId: o.id,
      name: o.name,
      quantity: o.qty,
      variant: o.variant,
      toppings: o.toppings,
      kitchenArea: o.kitchenArea,
    }));

    this.orderGateway.processOrderItems({
      orderItems: OrderItems,
      customerName,
      dataKey: key,
    });

    await this.preOrderService.pushTracking(id, confirmTracking);
    await this.preOrderService.pushTracking(id, prepareTracking);

    const tracking = await this.redis.get(keyTracking);
    const trackingUpdate = [
      ...tracking.tracking,
      confirmTracking,
      prepareTracking,
    ];
    await this.redis.set(keyTracking, { tracking: trackingUpdate }, 86400);

    const totalItems = OrderItems.length || 0;
    await this.orderGateway.handleDataOnline(
      id,
      customerName,
      totalItems,
      OrderItems,
      [],
    );

    const dataNotificationPreOrder = await this.redis.get(keyNotification);
    const confirmData = dataNotificationPreOrder.filter(
      (item: any) => id !== item.id,
    );

    await this.redis.set(keyNotification, confirmData);

    this.server
      .to('staff_room')
      .emit('staffPreOrderNotificationSync', confirmData);
  }

  // 🔔 Khi nhân viên hủy thông báo đơn
  @SubscribeMessage('handleCancelNotifyPreOrder')
  async handleCancelNotify(
    @MessageBody()
    dataCancel: {
      id: string;
      key: string;
      keyTb: string;
    },
  ) {
    const { id, key, keyTb } = dataCancel;
    const keyTracking = `pre-order:tracking:${id}`;
    const cancelTracking = {
      status: PRE_ORDER_STATUS.CANCELLED,
      timestamp: new Date(),
    };

    await this.redis.set(key, [], 86400);

    const dataNotificationPreOrder = await this.redis.get(keyTb);
    const cancelData = dataNotificationPreOrder.filter(
      (item: any) => id !== item.id,
    );

    await this.redis.set(keyTb, cancelData);

    await this.preOrderService.pushTracking(id, cancelTracking);

    const tracking = await this.redis.get(keyTracking);
    const trackingUpdate = [...tracking.tracking, cancelTracking];
    await this.redis.set(keyTracking, { tracking: trackingUpdate }, 86400);

    this.server
      .to('staff_room')
      .emit('staffPreOrderNotificationSync', cancelData);
  }

  @SubscribeMessage('getDataPreOrderDelivery')
  async handleDataPreOrderDelivery(@ConnectedSocket() client: Socket) {
    const deliveryKey = 'notification_pre-order_delivery';
    const dataDelivery = await this.preOrderService.fetchPreOrderDelivery();
    let dataPreOrderDelivery = (await this.redis.get(deliveryKey)) || [];
    // if (existingDelivery.length === 0) {
    //   await this.redis.set(deliveryKey, dataDelivery);
    //   dataPreOrderDelivery = dataDelivery;
    // }

    client.emit('dataPreOrderDelivery', dataPreOrderDelivery);
  }

  @SubscribeMessage('updatePreOrderDelivery')
  async handleUpdatePreOrderDelivery(
    @MessageBody() data: { orderId: string; dataUpdate: string },
  ) {
    const { orderId, dataUpdate } = data;
    const deliveryKey = 'notification_pre-order_delivery';
    const keyTracking = `pre-order:tracking:${orderId}`;

    // Lấy thông tin order
    const order = await this.preOrderService.findOne(orderId);

    // Chỉ xử lý nếu order có deliveryAddress
    if (!order?.deliveryAddress) {
      return; // Nếu không có địa chỉ giao thì thoát
    }

    const deliveryTracking = {
      status: PRE_ORDER_STATUS.DELIVERING,
      timestamp: new Date(),
    };

    // Lấy tracking hiện tại từ Redis
    const trackingData = await this.redis.get(keyTracking);
    const trackingUpdate = [
      ...(trackingData?.tracking || []),
      deliveryTracking,
    ];
    await this.redis.set(keyTracking, { tracking: trackingUpdate }, 86400);

    // Cập nhật vào service
    await this.preOrderService.pushTracking(orderId, deliveryTracking);

    // Lưu notification
    await this.redis.set(deliveryKey, dataUpdate);

    // Emit dữ liệu mới cho client
    this.server.emit('dataPreOrderDelivery', dataUpdate);
  }
}
