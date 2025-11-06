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
import { TableService } from 'src/table/table.service';
import { RedisService } from 'src/redis-cache/redis-cache.service';
import { table } from 'console';

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

  // 🪑 Khi user join bàn
  @SubscribeMessage('joinTable')
  async handleJoinTable(
    @MessageBody() data: { tableId: string; tableNumber: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { tableId, tableNumber } = data;
    client.join(`table_${tableNumber}`);
    console.log(`🪑 Client ${client.id} joined table ${tableNumber}`);

    // Lấy order hiện tại từ Redis, nếu chưa có thì tìm trong DB
    const redisKey = `table_${tableNumber}`;
    let currentOrder = await this.redis.get(redisKey);
    const dataOrderCurrent = await this.orderService.getOrderByTable(tableId);
    const currentOrderProcessing = dataOrderCurrent?.progressStatus;

    if (!currentOrder) {
      currentOrder = {
        orderItems: dataOrderCurrent?.orderItems || [],
        totalPrice: dataOrderCurrent?.totalPrice || 0,
      };
      if (currentOrder) {
        await this.redis.set(redisKey, currentOrder, 7200); // TTL 2h
      }
    }

    // Gửi lại cho client hiện tại
    if (currentOrder) {
      client.emit('currentOrder', currentOrder);
      client.emit('currentOrderProcessing', currentOrderProcessing);
    } else {
      client.emit('currentOrder', null);
    }
  }

  // 🔄 Khi người dùng thêm món (chưa gửi order)
  @SubscribeMessage('updateOrder')
  async handleUpdateOrder(
    @MessageBody()
    data: {
      currentOrderId: string;
      updateOrder: any;
      totalPrice: number;
      tableNumber: string;
    },
  ) {
    const {
      currentOrderId: orderId,
      updateOrder: orderItems,
      totalPrice,
      tableNumber,
    } = data;
    const redisKey = `table_${tableNumber}`;
    const updatedOrder = {
      orderItems,
      totalPrice,
    };

    this.server.to(`table_${tableNumber}`).emit('orderUpdated', updatedOrder);

    await this.redis.set(redisKey, updatedOrder, 7200);
  }

  // 📤 Khi khách gửi order
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

    if (isAddItems) {
      const oldOrder = await this.orderService.findOne(currentOrderId);

      const addedItems = orderItems
        .map((newItem) => {
          const oldItem = oldOrder.orderItems.find(
            (o) => o.menuItemId.toString() === newItem.menuItemId.toString(),
          );

          if (!oldItem) {
            // 🍽️ Món mới hoàn toàn
            return { ...newItem, addedQuantity: newItem.quantity };
          }

          // 🔢 Nếu tăng số lượng → tính phần chênh lệch
          if (newItem.quantity > oldItem.quantity) {
            const diff = newItem.quantity - oldItem.quantity;
            return { ...newItem, addedQuantity: diff };
          }

          // 🚫 Không thêm món hoặc giảm số lượng → bỏ qua
          return null;
        })
        .filter(Boolean);

      console.log('oldOrder', oldOrder);
      console.log('j.sahjfasdjhklafdsjhklfadsfajhdkslafdjhkslafdsjkhlfdalkj;n');
      console.log('orderItems', orderItems);
      console.log('j.sahjfasdjhklafdsjhklfadsfajhdkslafdjhkslafdsjkhlfdalkj;n');
      console.log('addedItems', addedItems);
      // 🔥 Emit riêng cho bếp (để biết có món mới)
      // if (addedItems.length > 0) {
      //   this.server.emit('newAddedItems', { tableNumber, addedItems });
      // }
    } else {
      await this.emitOrderStatusChanged(tableNumber, statusChanged);

      await this.orderService.update(currentOrderId, {
        orderItems,
        totalPrice,
        progressStatus: statusChanged,
        paymentStatus: 'unpaid',
      });
    }
  }

  // 💰 Khi khách thanh toán
  @SubscribeMessage('orderPaid')
  async handleOrderPaid(@MessageBody() orderId: string) {
    const { order, table } = await this.orderService.markOrderPaid(orderId);

    this.server.to(`table_${order.tableId}`).emit('orderStatusChanged', order);
    this.server.to(`table_${order.tableId}`).emit('tableStatusChanged', table);
  }

  // 🚪 Khi client rời bàn
  @SubscribeMessage('leaveTable')
  handleLeaveTable(
    @MessageBody() tableId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`table_${tableId}`);
    console.log(`🚪 Client ${client.id} left table_${tableId}`);
  }

  // ⚡ Hàm tiện ích để emit từ service
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
