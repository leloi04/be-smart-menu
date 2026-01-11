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
import { PreOrderService } from 'src/pre-order/pre-order.service';
import { PRE_ORDER_STATUS } from 'src/types/global.constanst';
import { TableService } from 'src/table/table.service';

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
    private readonly tableService: TableService,
    private readonly preOrderService: PreOrderService,
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
    const completedOrderKey = `completed_order_${tableNumber}`; // order đã hoàn thành

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
    if (!firstOrder) {
      firstOrder = {
        orderItems: [],
        totalPrice: 0,
      };
      await this.redis.set(redisFirstKey, firstOrder, 7200);
    }

    // 5️⃣ Khởi tạo addOrders nếu chưa có (mảng rỗng)
    let addOrders = await this.redis.get(addOrderKey);
    if (!addOrders) {
      addOrders = [];
      await this.redis.set(addOrderKey, addOrders, 7200);
    }

    let completedOrders = await this.redis.get(completedOrderKey);
    if (!completedOrders) {
      completedOrders = [];
    }

    // Emit dữ liệu về FE
    client.emit('currentOrder', currentOrder);
    client.emit('currentOrderProcessing', currentOrderProcessing);
    client.emit('firstOrder', firstOrder);
    client.emit('addOrders', addOrders);
    client.emit('completedOrders', completedOrders);
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
        await this.emitOrderStatusChanged(tableNumber, statusChanged);

        const batchId = `${Date.now()}`;

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

        const notificationKey = 'notification_table_order';
        const existingNotifications =
          (await this.redis.get(notificationKey)) || [];
        const newOrderNotification = {
          keyRedis: addOrderKey,
          batchId,
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

        this.server
          .to('staff_room')
          .emit('newOrderTable', newOrderNotification);

        // FE reset
        await this.redis.set(redisKey, { orderItems: [], totalPrice: 0 });
        this.server
          .to(`table_${tableNumber}`)
          .emit('orderUpdated', { orderItems: [], totalPrice: 0 });

        await this.orderService.changedStatus(
          { tableNumber },
          currentOrderId,
          statusChanged,
          redisKey,
        );

        return;
      }
    } else {
      await this.emitOrderStatusChanged(tableNumber, statusChanged);

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
        keyRedis: redisFirstKey,
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

      await this.orderService.changedStatus(
        { tableNumber },
        currentOrderId,
        statusChanged,
        redisKey,
      );
    }
  }

  @SubscribeMessage('orderPaid')
  async handleOrderPaid(@MessageBody() orderId: string) {
    const { order, table } = await this.orderService.markOrderPaid(orderId);

    this.server.to(`table_${order.tableId}`).emit('orderStatusChanged', order);
    this.server.to(`table_${order.tableId}`).emit('tableStatusChanged', table);
  }

  @SubscribeMessage('clearDataOrder')
  async handleClearDataOrder(@MessageBody() tableId: string) {
    const table = await this.tableService.findOne(tableId);
    const tableNumber = table?.tableNumber;
    if (!tableNumber) return;
    const redisFirstKey = `first_order_${tableNumber}`; // order gốc lần đầu
    const addOrderKey = `add_order_${tableNumber}`; // mảng batch add items
    const completedOrderKey = `completed_order_${tableNumber}`; // order đã hoàn thành

    await this.redis.del(redisFirstKey);
    await this.redis.del(addOrderKey);
    await this.redis.del(completedOrderKey);
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

  @SubscribeMessage('handleConfirmNotifyTable')
  async handleConfirmNotify(
    @MessageBody()
    dataConfirm: {
      id: string;
      key: string;
      orderItems?: any;
      priceOrder?: string | number;
    },
  ) {
    const { id, key, orderItems, priceOrder } = dataConfirm;

    const orderItemUpdate = orderItems.map((o) => ({
      menuItemId: o.id,
      name: o.name,
      quantity: o.qty,
      variant: o.variant,
      toppings: o.toppings,
    }));

    await this.orderService.updateOrderItems(id, orderItemUpdate, priceOrder);

    const dataNotificationTable = await this.redis.get(key);
    const confirmData = dataNotificationTable.filter(
      (item: any) => id !== item.id,
    );

    await this.redis.set(key, confirmData);

    this.server
      .to('staff_room')
      .emit('staffTableNotificationSync', confirmData);
  }

  @SubscribeMessage('handleCancelNotifyTable')
  async handleCancelNotify(
    @MessageBody()
    dataCancel: {
      id: string;
      key: string;
      batchId?: string;
      keyTb: string;
    },
  ) {
    const { id, key, batchId, keyTb } = dataCancel;

    if (batchId) {
      const dataKey = await this.redis.get(key);
      const dataKeyUpdate = dataKey.filter((i) => i.batchId !== batchId);
      await this.redis.set(key, dataKeyUpdate, 7200);
    } else {
      await this.redis.set(key, [], 7200);
    }

    const dataNotificationTable = await this.redis.get(keyTb);
    const cancelData = dataNotificationTable.filter(
      (item: any) => id !== item.id,
    );

    await this.redis.set(keyTb, cancelData);

    this.server.to('staff_room').emit('staffTableNotificationSync', cancelData);
  }

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

  async processOrderItems(data: {
    orderItems: any[];
    tableNumber?: string;
    customerName?: string;
    dataKey: string;
    batchId?: string;
  }) {
    const { dataKey, orderItems, batchId, customerName, tableNumber } = data;
    if (!Array.isArray(orderItems) || orderItems.length === 0) return null;

    const timestamp = new Date().toISOString();
    const areaMapping: Record<string, any[]> = {};

    // 1️⃣ Phân loại theo kitchenArea và chuẩn bị object
    for (const item of orderItems) {
      const area = (item.kitchenArea || 'UNKNOWN').toUpperCase();
      if (!areaMapping[area]) areaMapping[area] = [];

      if (tableNumber) {
        areaMapping[area].push({
          ...item,
          dataKey,
          batchId: batchId || null,
          tableNumber,
          timestamp,
        });
      } else {
        areaMapping[area].push({
          ...item,
          dataKey,
          customerName,
          timestamp,
        });
      }
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

    // tìm xem bàn đã tồn tại chưa
    const existedIndex = existingData.findIndex(
      (d: any) => d.tableNumber === tableNumber,
    );

    let updatedData;

    if (existedIndex !== -1) {
      // ✔ nếu tồn tại → cập nhật record cũ
      const existed = existingData[existedIndex];

      const updatedRecord = {
        ...existed,
        totalItems: existed.totalItems + totalItems,
      };

      updatedData = [...existingData];
      updatedData[existedIndex] = updatedRecord;

      // realtime
      this.server.to('staff_room').emit('dataTableUpdated', updatedRecord);
    } else {
      // ✔ nếu chưa tồn tại → tạo mới
      const newRecord = {
        tableNumber,
        totalItems,
        orderItemsCompleted,
        timestamp: new Date().toISOString(),
      };

      updatedData = [...existingData, newRecord];

      // realtime
      this.server.to('staff_room').emit('dataTableUpdated', newRecord);
    }

    // lưu vào redis
    await this.redis.set(redisKey, updatedData);
  }

  async handleDataOnline(
    id: string,
    customerName: string,
    totalItems: number,
    orderItems: any[],
    orderItemsCompleted: any[],
  ) {
    const redisKey = 'data_pre-order';
    const existingData = (await this.redis.get(redisKey)) || [];
    const dataPreOrder = {
      id,
      customerName,
      totalItems,
      orderItems,
      orderItemsCompleted,
      timestamp: new Date().toISOString(),
    };
    const updatedData = [...existingData, dataPreOrder];
    this.server.to('staff_room').emit('dataPreOrderUpdated', dataPreOrder);
    await this.redis.set(redisKey, updatedData);
  }

  @SubscribeMessage('handleCompletedItem')
  async handleCompletedItem(@MessageBody() data: any) {
    const {
      kitchenArea,
      tableNumber,
      batchId,
      dataKey,
      menuItemId,
      customerName,
    } = data;
    const dataTableKey = 'data_table';
    const dataPreOrderKey = 'data_pre-order';
    if (tableNumber) {
      const firstOrderKey = `first_order_${tableNumber}`;
      const addOrderKey = `add_order_${tableNumber}`;
      const completedKey = `completed_order_${tableNumber}`;
      const dataCompletedOrder = (await this.redis.get(completedKey)) || [];
      if (batchId) {
        // data Order
        const dataOrderInKey = (await this.redis.get(dataKey)).find(
          (i) => i.batchId == batchId,
        ).orderItems;

        // items different
        const itemsDf = dataOrderInKey.filter(
          (i) => i.menuItemId != menuItemId,
        );
        // item completed
        const item = dataOrderInKey.find((i) => i.menuItemId == menuItemId);

        const dataKeyRedisOrder = await this.redis.get(dataKey);

        const dataInBatch = dataKeyRedisOrder.find((i) => i.batchId == batchId);
        const dataExBatch = dataKeyRedisOrder.filter(
          (i) => i.batchId !== batchId,
        );
        const dataReplaceOfBatch = {
          ...dataInBatch,
          orderItems: itemsDf,
        };
        const dataSetInKeyOrder = [dataReplaceOfBatch, ...dataExBatch];
        await this.redis.set(dataKey, dataSetInKeyOrder, 7200);

        this.server
          .to(`table_${tableNumber}`)
          .emit('addOrders', dataSetInKeyOrder);

        const dataOrderCompleted = [
          ...dataCompletedOrder,
          {
            dataKey,
            batchId,
            ...item,
            timestamp: new Date().toISOString(),
          },
        ];
        await this.redis.set(completedKey, dataOrderCompleted, 7200);

        this.server
          .to(`table_${tableNumber}`)
          .emit('completedOrders', dataOrderCompleted);

        // Set Completed order in data table of staff
        const dataTable = await this.redis.get(dataTableKey);
        const dataOfTableDf = dataTable.filter(
          (i) => i.tableNumber != tableNumber,
        );
        const dataOfTableCurrent = dataTable.find(
          (i) => i.tableNumber == tableNumber,
        );
        const orderItemsCompleted = [
          ...dataOfTableCurrent.orderItemsCompleted,
          {
            batchId,
            dataKey,
            ...item,
            timestamp: new Date().toISOString(),
          },
        ];
        const dataSetIntoKey = [
          ...dataOfTableDf,
          {
            ...dataOfTableCurrent,
            orderItemsCompleted,
          },
        ];
        await this.redis.set(dataTableKey, dataSetIntoKey);

        this.server.to('staff_room').emit('dataTable', dataSetIntoKey);

        // data orders in chef
        const dataOrderInChef = await this.redis.get(`${kitchenArea}_chef`);

        // data orders in chef df
        const itemsDfInChef = dataOrderInChef.filter(
          (i) =>
            i.menuItemId !== menuItemId ||
            i.dataKey !== dataKey ||
            i.batchId !== batchId,
        );

        await this.redis.set(`${kitchenArea}_chef`, itemsDfInChef);

        this.server.to(`${kitchenArea}_room`).emit('currentOrderItems', {
          area: kitchenArea,
          items: itemsDfInChef,
        });
      } else {
        // data Order
        const dataOrderInKey = (await this.redis.get(dataKey)).orderItems;

        // items different
        const itemsDf = dataOrderInKey.filter(
          (i) => i.menuItemId != menuItemId,
        );
        // item completed
        const item = dataOrderInKey.find((i) => i.menuItemId == menuItemId);

        const dataKeyRedisOrder = await this.redis.get(dataKey);

        const dataSetInKeyOrder = {
          ...dataKeyRedisOrder,
          orderItems: itemsDf,
        };
        await this.redis.set(dataKey, dataSetInKeyOrder, 7200);

        this.server
          .to(`table_${tableNumber}`)
          .emit('firstOrder', dataSetInKeyOrder);

        const dataOrderCompleted = [
          ...dataCompletedOrder,
          {
            dataKey,
            ...item,
            timestamp: new Date().toISOString(),
          },
        ];
        await this.redis.set(completedKey, dataOrderCompleted, 7200);

        this.server
          .to(`table_${tableNumber}`)
          .emit('completedOrders', dataOrderCompleted);

        // Set Completed order in data table of staff
        const dataTable = await this.redis.get(dataTableKey);
        const dataOfTableDf = dataTable.filter(
          (i) => i.tableNumber != tableNumber,
        );
        const dataOfTableCurrent = dataTable.find(
          (i) => i.tableNumber == tableNumber,
        );
        const orderItemsCompleted = [
          ...dataOfTableCurrent.orderItemsCompleted,
          {
            dataKey,
            ...item,
            timestamp: new Date().toISOString(),
          },
        ];
        const dataSetIntoKey = [
          ...dataOfTableDf,
          {
            ...dataOfTableCurrent,
            orderItemsCompleted,
          },
        ];
        await this.redis.set(dataTableKey, dataSetIntoKey);

        this.server.to('staff_room').emit('dataTable', dataSetIntoKey);

        // data orders in chef
        const dataOrderInChef = await this.redis.get(`${kitchenArea}_chef`);

        // data orders in chef df
        const itemsDfInChef = dataOrderInChef.filter(
          (i) =>
            i.menuItemId !== menuItemId ||
            i.dataKey !== dataKey ||
            i.batchId !== batchId,
        );

        await this.redis.set(`${kitchenArea}_chef`, itemsDfInChef);

        this.server.to(`${kitchenArea}_room`).emit('currentOrderItems', {
          area: kitchenArea,
          items: itemsDfInChef,
        });
      }

      const dataFirstOrder = (await this.redis.get(firstOrderKey)) || {
        orderItems: [],
      };
      const dataAddsOrder = (await this.redis.get(addOrderKey)) || [
        { orderItems: [] },
      ];
      const lengthFirstOrder = dataFirstOrder.orderItems.length;
      const lengthAddsOrder = dataAddsOrder.reduce((a, c) => {
        return a + c.orderItems.length;
      }, 0);
      if (lengthFirstOrder == 0 && lengthAddsOrder == 0) {
        this.emitOrderStatusChanged(tableNumber, 'completed');
        await this.orderService.completedOrder(tableNumber);
      }
    } else if (customerName) {
      const preOrderId = dataKey.slice(dataKey.indexOf(':') + 1);

      const dataPreOrders = (await this.redis.get(dataPreOrderKey)) || [];

      const currentPreOrder = dataPreOrders.find((i) => i.id === preOrderId);

      if (!currentPreOrder) return;

      const dataOrderInKey = currentPreOrder.orderItems;

      //Item completed
      const item = dataOrderInKey.find((i) => i.menuItemId === menuItemId);

      // Items còn lại
      const itemsDf = dataOrderInKey.filter((i) => i.menuItemId !== menuItemId);

      // Replace pre-order
      const dataReplace = {
        ...currentPreOrder,
        orderItems: itemsDf,
        orderItemsCompleted: [
          ...currentPreOrder.orderItemsCompleted,
          { ...item, timestamp: new Date().toISOString() },
        ],
      };

      const dataDf = dataPreOrders.filter((i) => i.id !== preOrderId);

      const dataSetInRedis = [dataReplace, ...dataDf];

      const lengthItemsCompleted = dataReplace.orderItemsCompleted.length || 0;
      const totalItems = dataReplace.totalItems || 0;

      if (lengthItemsCompleted === totalItems) {
        const keyTracking = `pre-order:tracking:${preOrderId}`;
        const readyTracking = {
          status: PRE_ORDER_STATUS.READY,
          timestamp: new Date(),
        };
        await this.preOrderService.pushTracking(preOrderId, readyTracking);
        const tracking = await this.redis.get(keyTracking);
        const trackingUpdate = [...tracking.tracking, readyTracking];
        await this.redis.set(keyTracking, { tracking: trackingUpdate }, 86400);

        const deliveryKey = 'notification_pre-order_delivery';
        const dataDeliveryNotifications =
          (await this.redis.get(deliveryKey)) || [];
        const dataPreOrder = await this.preOrderService.findOne(preOrderId);
        const dataCustomer = dataPreOrder?.customerId as any;
        const newDeliveryNotification = {
          id: preOrderId,
          customerName: dataCustomer?.name,
          phone: dataCustomer?.phone,
          orderItems: dataPreOrder?.orderItems,
          totalPayment: dataPreOrder?.totalPayment,
          deliveryAddress: dataPreOrder?.deliveryAddress,
          timestamp: new Date().toISOString(),
          note: dataPreOrder?.note || '',
        };
        await this.redis.set(deliveryKey, [
          ...dataDeliveryNotifications,
          newDeliveryNotification,
        ]);
      }

      await this.server.to('staff_room').emit('dataPreOrder', dataSetInRedis);

      await this.redis.set(dataPreOrderKey, dataSetInRedis);

      // Xóa item khỏi chef
      const dataOrderInChef = await this.redis.get(`${kitchenArea}_chef`);

      const itemsDfInChef = dataOrderInChef.filter(
        (i) =>
          i.menuItemId !== menuItemId ||
          i.dataKey !== dataKey ||
          i.batchId !== batchId,
      );

      await this.redis.set(`${kitchenArea}_chef`, itemsDfInChef);

      this.server.to(`${kitchenArea}_room`).emit('currentOrderItems', {
        area: kitchenArea,
        items: itemsDfInChef,
      });
    }
  }

  // 🧑‍🍳 Staff Join Room
  @SubscribeMessage('joinStaff')
  async handleJoinStaff(@ConnectedSocket() client: Socket) {
    client.join('staff_room');

    // Lấy dữ liệu notification từ Redis
    const notificationTableKey = 'notification_table_order';
    const notificationPreOrderKey = 'notification_pre-order';
    const tableNotifications =
      (await this.redis.get(notificationTableKey)) || []; // default rỗng
    const preOrderNotifications =
      (await this.redis.get(notificationPreOrderKey)) || []; // default rỗng

    // Lấy dữ liệu data_table từ Redis
    const redisKey = 'data_table';
    const redisKeyPreOrder = 'data_pre-order';
    const dataTable = (await this.redis.get(redisKey)) || [];
    const dataPreOrder = (await this.redis.get(redisKeyPreOrder)) || [];

    // Gửi lại cho staff vừa join
    client.emit('staffTableNotificationSync', tableNotifications);
    client.emit('staffPreOrderNotificationSync', preOrderNotifications);
    client.emit('dataTable', dataTable);
    client.emit('dataPreOrder', dataPreOrder);
  }

  @SubscribeMessage('leaveStaff')
  handleLeaveStaff(@ConnectedSocket() client: Socket) {
    client.leave('staff_room');
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
  }

  @SubscribeMessage('leaveChefArea')
  handleLeaveChefArea(
    @ConnectedSocket() client: Socket,
    @MessageBody() area: string,
  ) {
    const roomName = `${area}_room`;
    client.leave(roomName);
  }
}
