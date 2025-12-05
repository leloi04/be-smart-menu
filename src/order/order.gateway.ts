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

    const redisKey = `table_${tableNumber}`; // order đang xử lý ở FE
    const redisFirstKey = `first_order_${tableNumber}`; // order gốc lần đầu
    const addOrderKey = `add_order_${tableNumber}`; // mảng batch add items

    // 1️⃣ Lấy current order đang xử lý
    let currentOrder = await this.redis.get(redisKey);

    // 2️⃣ Lấy order từ DB
    const dbOrder = await this.orderService.getOrderByTable(tableId);
    const currentOrderProcessing = dbOrder?.progressStatus;

    // 3️⃣ Khởi tạo currentOrder nếu chưa có
    if (!currentOrder) {
      currentOrder = { orderItems: [], totalPrice: 0 };
      await this.redis.set(redisKey, currentOrder, 7200);
    }

    // 4️⃣ Khởi tạo firstOrder nếu chưa có
    let firstOrder = await this.redis.get(redisFirstKey);
    if (!firstOrder && dbOrder) {
      firstOrder = {
        orderItems: dbOrder.orderItems || [],
        totalPrice: dbOrder.totalPrice || 0,
      };
      await this.redis.set(redisFirstKey, firstOrder, 7200);
    }

    // 5️⃣ Khởi tạo addOrders nếu chưa có (mảng rỗng)
    let addOrders = await this.redis.get(addOrderKey);
    if (!addOrders) {
      addOrders = [];
      await this.redis.set(addOrderKey, addOrders, 7200);
    }

    // 6️⃣ Emit dữ liệu về FE
    client.emit('currentOrder', currentOrder);
    client.emit('currentOrderProcessing', currentOrderProcessing);
    client.emit('firstOrder', firstOrder);
    client.emit('addOrders', addOrders); // FE có thể hiển thị các batch thêm
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
    const addOrderKey = `add_order_${tableNumber}`;

    // ✔ Lọc quantity > 0 trước khi xử lý DB
    const cleanOrderItems = this.sanitizeOrder(orderItems);

    if (isAddItems) {
      if (isAddItems) {
        const batchId = `${Date.now()}`;
        const addOrderKey = `add_order_${tableNumber}`;

        // Lấy danh sách batch hiện tại
        const existingBatches = (await this.redis.get(addOrderKey)) || [];

        const newBatch = {
          batchId,
          orderItems: cleanOrderItems,
          totalPrice,
          timestamp: new Date().toISOString(),
        };

        // Gộp batch mới vào list
        const updatedBatches = [...existingBatches, newBatch];

        // Lưu lại
        await this.redis.set(addOrderKey, updatedBatches, 7200);

        // Gửi lần thêm về FE
        this.server.to(`table_${tableNumber}`).emit('addItemsOrder', newBatch);

        // FE reset
        await this.redis.set(redisKey, { orderItems: [], totalPrice: 0 });
        this.server
          .to(`table_${tableNumber}`)
          .emit('orderUpdated', { orderItems: [], totalPrice: 0 });

        // Gửi cho staff
        // this.server.to("staff_room").emit("newOrderTable", {
        //   type: "addItems",
        //   ...newBatch,
        //   tableNumber,
        // });

        return;
      }
    } else {
      // 🚀 Gửi order lần đầu
      await this.emitOrderStatusChanged(tableNumber, statusChanged);

      await this.orderService.update(currentOrderId, {
        orderItems: cleanOrderItems,
        totalPrice,
        progressStatus: statusChanged,
        paymentStatus: 'unpaid',
      });

      await this.redis.set(
        redisFirstKey,
        {
          orderItems: cleanOrderItems,
          totalPrice,
          timestamp: new Date().toISOString(),
        },
        7200,
      );

      await this.redis.set(redisKey, {
        orderItems: cleanOrderItems,
        totalPrice,
        timestamp: new Date().toISOString(),
      });

      // 📬 Lưu order lần đầu tiên vào notification_table_order
      const notificationKey = 'notification_table_order';
      const existingNotifications =
        (await this.redis.get(notificationKey)) || [];
      const newOrderNotification = {
        id: currentOrderId,
        tableNumber,
        orderItems: cleanOrderItems,
        totalPrice,
        timestamp: new Date().toISOString(),
      };
      await this.redis.set(notificationKey, [
        ...existingNotifications,
        newOrderNotification,
      ]);

      // Gửi lần đầu về FE
      this.server.to(`table_${tableNumber}`).emit('firstOrder', {
        orderItems: cleanOrderItems,
        totalPrice,
        timestamp: new Date().toISOString(),
      });

      // Staff nhận notification lần đầu
      this.server.to('staff_room').emit('newOrderTable', newOrderNotification);

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

  @SubscribeMessage('getDetailTable')
  async handleGetDetailTable(@MessageBody() tableNumber: string) {
    const redisFirstKey = `first_order_${tableNumber}`;
    const addOrderKey = `add_order_${tableNumber}`;
    const completedOrderKey = `completed_order_${tableNumber}`;

    let firstOrder = await this.redis.get(redisFirstKey);
    if (!firstOrder) {
      firstOrder = { orderItems: [], totalPrice: 0 };
    }

    let addOrders = await this.redis.get(addOrderKey);
    if (!addOrders) {
      addOrders = [];
    }

    let completedOrders = await this.redis.get(completedOrderKey);
    if (!completedOrders) {
      completedOrders = [];
    }
    this.server.to('staff_room').emit('detailTableData', {
      firstOrder,
      addOrders,
      completedOrders,
    });
  }

  // @SubscribeMessage('handleConfirmNotify')
  // async handleConfirmNotify(@MessageBody() dataConfirm: any[]) {
  //   const notificationKey = 'notification_table_order';

  //   await this.redis.set(notificationKey, dataConfirm);

  //   this.server.to('staff_room').emit('staffNotificationSync', dataConfirm);
  // }

  @SubscribeMessage('emitGetDataInKeyRedis')
  async handleGetDataInKeyRedis(
    @MessageBody() redisKey: string,
    @ConnectedSocket() client: Socket,
  ) {
    const data = await this.redis.get(redisKey);
    client.emit('dataInRedisKey', data);
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

  async processOrderItems(
    orderItems: any[],
    tableNumber: string,
    dataKey: string,
    batchId?: string,
  ) {
    if (!Array.isArray(orderItems) || orderItems.length === 0) return null;

    const timestamp = new Date().toISOString();
    const areaMapping: Record<string, any[]> = {};

    // 1️⃣ Phân loại theo kitchenArea và chuẩn bị object
    for (const item of orderItems) {
      const area = (item.kitchenArea || 'UNKNOWN').toUpperCase();
      if (!areaMapping[area]) areaMapping[area] = [];

      areaMapping[area].push({
        ...item,
        dataKey,
        batchId: batchId || null,
        tableNumber,
        timestamp,
      });
    }

    const savedAreas: Record<string, any> = {};

    // 2️⃣ Lưu vào Redis từng khu
    for (const area of Object.keys(areaMapping)) {
      const areaKey = `${area}_chef`;
      const itemsForArea = areaMapping[area];

      // Lấy dữ liệu hiện có từ Redis
      const existing = (await this.redis.get(areaKey)) || [];

      // Thêm món mới vào
      const updated = [...existing, ...itemsForArea];

      // Lưu lại
      await this.redis.set(areaKey, updated);

      // Lưu kết quả trả về cho debug
      savedAreas[areaKey] = itemsForArea;
    }

    // Sau khi đã lưu vào Redis từng khu
    for (const areaKey of Object.keys(savedAreas)) {
      const itemsForArea = savedAreas[areaKey];

      // Lấy tên khu từ areaKey (ví dụ 'HOT_chef' => 'HOT')
      const area = areaKey.replace('_chef', '');

      // Emit realtime cho từng khu
      this.server.to(`${area}_room`).emit('newOrderItems', itemsForArea);
    }
  }

  async handleDataTable(
    tableNumber: string,
    totalItems: number,
    orderItemsCompleted: any[],
  ) {
    const redisKey = 'data_table';
    const existingData = (await this.redis.get(redisKey)) || [];

    const dataTable = {
      tableNumber,
      totalItems,
      orderItemsCompleted,
      timestamp: new Date().toISOString(),
    };

    const updatedData = [...existingData, dataTable];

    this.server.to('staff_room').emit('dataTableUpdated', dataTable);

    await this.redis.set(redisKey, updatedData);
  }

  // 🧑‍🍳 Staff Join Room
  @SubscribeMessage('joinStaff')
  async handleJoinStaff(@ConnectedSocket() client: Socket) {
    client.join('staff_room');

    // Lấy dữ liệu notification_table_order từ Redis
    const notificationKey = 'notification_table_order';
    const notifications = (await this.redis.get(notificationKey)) || []; // default rỗng

    // Lấy dữ liệu data_table từ Redis
    const redisKey = 'data_table';
    const dataTable = (await this.redis.get(redisKey)) || [];

    // Gửi lại cho staff vừa join
    client.emit('staffNotificationSync', notifications);
    client.emit('dataTable', dataTable);

    console.log(`Staff ${client.id} joined staff_room`);
  }

  @SubscribeMessage('leaveStaff')
  handleLeaveStaff(@ConnectedSocket() client: Socket) {
    client.leave('staff_room');
    console.log(`Staff ${client.id} left staff_room`);
  }

  // 🧑‍🍳 Chef Join Area Room
  @SubscribeMessage('joinChefArea')
  async handleJoinChefArea(
    @ConnectedSocket() client: Socket,
    @MessageBody() area: string,
  ) {
    // 1️⃣ Nếu chef đã join room khác, leave hết
    const rooms = Array.from(client.rooms).filter((r) => r !== client.id);
    rooms.forEach((r) => client.leave(r));

    // 2️⃣ Join vào room mới
    const roomName = `${area}_room`;
    const chefName = `${area}_chef`;
    client.join(roomName);

    // 3️⃣ Lấy dữ liệu hiện có từ Redis
    let existingItems: any[] = [];
    try {
      existingItems = (await this.redis.get(chefName)) || [];
    } catch (err) {
      existingItems = [];
    }

    // 4️⃣ Gửi dữ liệu hiện có lên client vừa join
    client.emit('currentOrderItems', {
      area,
      items: existingItems,
    });

    console.log(`Chef ${client.id} joined ${roomName}`);
  }

  @SubscribeMessage('leaveChefArea')
  handleLeaveChefArea(
    @ConnectedSocket() client: Socket,
    @MessageBody() area: string,
  ) {
    const roomName = `${area}_room`;
    client.leave(roomName);
    console.log(`Chef ${client.id} left ${roomName}`);
  }
}
