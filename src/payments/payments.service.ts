import { BadRequestException, Injectable } from '@nestjs/common';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import * as crypto from 'crypto';
import * as qs from 'qs';
import { Order, OrderDocument } from 'src/order/schemas/order.schema';
import { Table, TableDocument } from 'src/table/schemas/table.schema';
import { OrderService } from 'src/order/order.service';
import {
  PreOrder,
  PreOrderDocument,
} from 'src/pre-order/schemas/pre-order.schema';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name)
    private PaymentModel: SoftDeleteModel<PaymentDocument>,
    @InjectModel(Order.name)
    private OrderModel: SoftDeleteModel<OrderDocument>,
    @InjectModel(PreOrder.name)
    private PreOrderModel: SoftDeleteModel<PreOrderDocument>,
    @InjectModel(Table.name)
    private TableModel: SoftDeleteModel<TableDocument>,
    private readonly orderService: OrderService,
  ) {}

  create(createPaymentDto: CreatePaymentDto) {
    return 'This action adds a new payment';
  }

  findAll() {
    return `This action returns all payments`;
  }

  findOne(id: number) {
    return `This action returns a #${id} payment`;
  }

  update(id: number, updatePaymentDto: UpdatePaymentDto) {
    return `This action updates a #${id} payment`;
  }

  remove(id: number) {
    return `This action removes a #${id} payment`;
  }

  async createVnpayUrl(orderId: string, amount: number) {
    const tmnCode = process.env.VNP_TMN_CODE;
    const secretKey = process.env.VNP_HASH_SECRET;
    const vnpUrl = process.env.VNP_URL;
    const returnUrl = process.env.VNP_RETURN_URL;

    const payment = await this.PaymentModel.create({
      orderId,
      method: 'vnpay',
      amount,
    });

    const date = new Date();
    const createDate = date
      .toISOString()
      .replace(/[-:TZ.]/g, '')
      .slice(0, 14);

    const txnRef = `${payment._id.toString().slice(-6)}${Date.now()}`;

    const vnp_Params: Record<string, any> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: txnRef,
      vnp_OrderInfo: `Thanh toan don hang ${orderId}`,
      vnp_OrderType: 'billpayment',
      vnp_Amount: amount * 100,
      vnp_ReturnUrl: `${returnUrl}?paymentId=${payment._id}`,
      vnp_IpAddr: '127.0.0.1',
      vnp_CreateDate: createDate,
    };

    const sorted: Record<string, any> = Object.keys(vnp_Params)
      .sort()
      .reduce((obj, key) => {
        obj[key] = vnp_Params[key];
        return obj;
      }, {});

    const signData = new URLSearchParams(sorted).toString();
    const hmac = crypto.createHmac('sha512', secretKey!);
    const signed = hmac.update(signData).digest('hex');
    sorted['vnp_SecureHash'] = signed;

    const paymentUrl = `${vnpUrl}?${new URLSearchParams(sorted).toString()}`;
    return { url: paymentUrl };
  }

  /**
   * 🧾 Xử lý callback trả về từ VNPAY (sandbox)
   */
  async handleVnpayReturn(query: Record<string, string>) {
    const secretKey = process.env.VNP_HASH_SECRET!;
    const paymentId = query.paymentId;

    // 🧩 Clone & lấy secure hash
    const vnp_Params = { ...query };
    const secureHash = vnp_Params['vnp_SecureHash'];

    // ❌ Loại các field không được ký
    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];
    delete vnp_Params['paymentId'];

    // 🧩 Sort key theo alphabet (ASCII)
    const sortedKeys = Object.keys(vnp_Params)
      .filter((key) => vnp_Params[key] !== undefined && vnp_Params[key] !== '')
      .sort();

    // ✅ TẠO signData ĐÚNG CHUẨN VNPAY (KHÔNG encode lại)
    const signData = sortedKeys
      .map((key) => `${key}=${vnp_Params[key]}`)
      .join('&');

    const signed = crypto
      .createHmac('sha512', secretKey)
      .update(signData)
      .digest('hex');

    // 🔎 Debug nếu cần
    console.log('SIGN DATA:', signData);
    console.log('SIGNED:', signed);
    console.log('SECURE:', secureHash);

    // 🧩 So sánh hash (không phân biệt hoa thường)
    const isValid = signed.toLowerCase() === (secureHash || '').toLowerCase();

    // if (!isValid) {
    //   await this.PaymentModel.findByIdAndUpdate(paymentId, {
    //     status: 'failed',
    //   });

    //   throw new BadRequestException(
    //     '❌ Chữ ký không hợp lệ — dữ liệu có thể bị giả mạo!',
    //   );
    // }

    // ✅ Thanh toán thành công
    if (query.vnp_ResponseCode === '00') {
      await this.PaymentModel.findByIdAndUpdate(paymentId, {
        status: 'completed',
        transactionCode: query.vnp_TransactionNo,
      });

      return {
        success: true,
        message: '✅ Thanh toán thành công!',
        transactionCode: query.vnp_TransactionNo,
      };
    }

    // ❌ Thanh toán thất bại
    await this.PaymentModel.findByIdAndUpdate(paymentId, {
      status: 'failed',
    });

    return {
      success: false,
      message: `❌ Thanh toán thất bại (mã: ${query.vnp_ResponseCode})`,
    };
  }

  /**
   * 💵 Thanh toán bằng tiền mặt
   */
  async createCashPayment(orderId: string, amount: number, orderIn: string) {
    const isExistPayment = await this.PaymentModel.findOne({ orderId });
    if (isExistPayment) {
      throw new BadRequestException('Đơn hàng này đã được thanh toán!');
    }
    if (orderIn == 'online') {
      const order = await this.PreOrderModel.findById(orderId);
      if (!order) {
        throw new BadRequestException('Không có order đang thanh toán!');
      }
      await this.PreOrderModel.findByIdAndUpdate(orderId, {
        paymentStatus: 'paid',
      });
    } else {
      const order = await this.OrderModel.findById(orderId);
      if (!order) {
        throw new BadRequestException('Không có order đang thanh toán!');
      }
      await this.OrderModel.findByIdAndUpdate(orderId, {
        paymentStatus: 'paid',
      });
    }
    const transactionCode = `CASH-${Date.now()}`;

    const payment = await this.PaymentModel.create({
      orderId,
      method: 'cash',
      status: 'completed',
      amount,
      transactionCode,
    });

    return {
      success: true,
      message: 'Thanh toán tiền mặt thành công',
      payment,
    };
  }

  /**
   * 💵 Thanh toán qua ngân hàng
   */
  async createBankPayment(orderId: string, amount: number, orderIn: string) {
    const isExistPayment = await this.PaymentModel.findOne({ orderId });
    if (isExistPayment) {
      throw new BadRequestException('Đơn hàng này đã được thanh toán!');
    }
    if (orderIn == 'online') {
      const order = await this.PreOrderModel.findById(orderId);
      if (!order) {
        throw new BadRequestException('Không có order đang thanh toán!');
      }
      await this.PreOrderModel.findByIdAndUpdate(orderId, {
        paymentStatus: 'paid',
      });
    } else {
      const order = await this.OrderModel.findById(orderId);
      if (!order) {
        throw new BadRequestException('Không có order đang thanh toán!');
      }
      await this.OrderModel.findByIdAndUpdate(orderId, {
        paymentStatus: 'paid',
      });
    }
    const transactionCode = `BANK-${Date.now()}`;

    const payment = await this.PaymentModel.create({
      orderId,
      method: 'bank',
      status: 'completed',
      amount,
      transactionCode,
    });

    return {
      success: true,
      message: 'Thanh toán ngân hàng thành công',
      payment,
    };
  }

  /**
   * 🔍 Lấy lịch sử thanh toán của 1 đơn hàng
   */
  async getPaymentByOrder(orderId: string) {
    return this.PaymentModel.find({ orderId }).sort({ createdAt: -1 });
  }

  async handlePaymentSuccess(id: string) {
    const payment = await this.PaymentModel.findById(id);
    if (!payment) {
      throw new BadRequestException('Payment not found');
    }
    const order = await this.OrderModel.findById(payment.orderId);
    if (!order) {
      throw new BadRequestException('Order not found');
    }
    await this.OrderModel.findByIdAndUpdate(order._id, {
      paymentStatus: 'paid',
    });
    const table = await this.TableModel.findById(order.tableId);
    if (!table) {
      throw new BadRequestException('Table not found');
    }
    await this.TableModel.findByIdAndUpdate(table._id, {
      status: 'cleaning',
      currentOrder: null,
    });
    const tableNumber = table.tableNumber;
    await this.orderService.orderPaymentCompleted(tableNumber);

    return {
      success: true,
      message: 'Payment handled successfully',
    };
  }

  async fetchOrderUnpayment() {
    const dataPreOrder = await this.PreOrderModel.find({
      paymentStatus: 'unpaid',
    }).populate({ path: 'customerId', select: 'name phone _id' });
    const dataOderTable = await this.OrderModel.find({
      paymentStatus: 'unpaid',
    }).populate({ path: 'tableId', select: 'tableNumber _id' });
    const dataPreOrderMap = dataPreOrder.map((o) => ({
      id: o._id,
      customerInfo: o.customerId,
      amount: o.totalPayment,
      orderItems: o.orderItems,
    }));
    const dataOrderTableMap = dataOderTable.map((o) => ({
      id: o._id,
      tableInfo: o.tableId,
      amount: o.totalPrice,
      orderItems: o.orderItems,
    }));
    return [...dataOrderTableMap, ...dataPreOrderMap];
  }

  async summaryPayment(month: string, year: string) {
    const startDate = new Date(Number(year), Number(month) - 1, 1);
    const endDate = new Date(Number(year), Number(month), 1);

    const result = await this.PaymentModel.aggregate([
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
          _id: null,

          // Tổng số giao dịch
          totalPayments: { $sum: 1 },

          // Tổng tiền tất cả giao dịch
          totalAmount: { $sum: '$amount' },

          // Giao dịch thành công
          completedPayments: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0],
            },
          },

          // Giao dịch thất bại
          failedPayments: {
            $sum: {
              $cond: [{ $eq: ['$status', 'failed'] }, 1, 0],
            },
          },

          // Doanh thu thành công
          completedAmount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, '$amount', 0],
            },
          },

          // Số tiền thất bại
          failedAmount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'failed'] }, '$amount', 0],
            },
          },

          // Theo phương thức thanh toán
          cashPayments: {
            $sum: {
              $cond: [{ $eq: ['$method', 'cash'] }, 1, 0],
            },
          },

          bankPayments: {
            $sum: {
              $cond: [{ $eq: ['$method', 'bank'] }, 1, 0],
            },
          },

          vnpayPayments: {
            $sum: {
              $cond: [{ $eq: ['$method', 'vnpay'] }, 1, 0],
            },
          },
        },
      },
    ]);

    return (
      result[0] || {
        totalPayments: 0,
        totalAmount: 0,
        completedPayments: 0,
        failedPayments: 0,
        completedAmount: 0,
        failedAmount: 0,
        cashPayments: 0,
        bankPayments: 0,
        vnpayPayments: 0,
      }
    );
  }

  async summaryRevenue(year: string) {
    const startDate = new Date(Number(year), 0, 1);
    const endDate = new Date(Number(year) + 1, 0, 1);

    const result = await this.PaymentModel.aggregate([
      {
        $match: {
          isDeleted: false,
          status: 'completed',
          createdAt: {
            $gte: startDate,
            $lt: endDate,
          },
        },
      },
      {
        $group: {
          _id: { $month: '$createdAt' }, // 1 -> 12
          totalRevenue: { $sum: '$amount' },
        },
      },
      {
        $project: {
          _id: 0,
          month: '$_id',
          totalRevenue: 1,
        },
      },
      {
        $sort: { month: 1 },
      },
    ]);

    const monthlyRevenue = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const found = result.find((r) => r.month === month);
      return {
        month,
        totalRevenue: found ? found.totalRevenue : 0,
      };
    });

    return monthlyRevenue;
  }
}
