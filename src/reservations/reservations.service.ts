import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Reservation, ReservationDocument } from './schemas/reservation.schema';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { IUser } from 'src/types/global.constanst';
import aqp from 'api-query-params';
import { BullQueueService } from 'src/bull-queue/bull-queue.service';
import { ReservationsGateway } from './reservations.gateway';

@Injectable()
export class ReservationsService implements OnModuleInit {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(
    @InjectModel(Reservation.name)
    private ReservationModel: SoftDeleteModel<ReservationDocument>,
    private readonly reservationsGateway: ReservationsGateway,
    private readonly bullQueueService: BullQueueService,
  ) {}

  /** 🚀 Khi module khởi tạo, đăng ký job định kỳ đánh dấu hết hạn */
  async onModuleInit() {
    await this.bullQueueService.addMarkExpiredReservationsJob();
    this.logger.log(
      '🧭 Đã đăng ký job tự động kiểm tra đặt bàn hết hạn (Bull Queue).',
    );
  }

  /** 🧾 Tạo mới đặt bàn */
  async create(createReservationDto: CreateReservationDto) {
    const { date, timeSlot, tableId } = createReservationDto;
    const isExisting = await this.ReservationModel.findOne({
      date,
      timeSlot,
      tableId,
    }).populate({
      path: 'tableId',
      select: { tableNumber: 1, _id: 1 },
    });
    const dataTable = isExisting?.tableId as any as {
      _id: string;
      tableNumber: string;
    };
    if (isExisting) {
      throw new BadRequestException(
        `${timeSlot} vào ngày ${date} đã có người đặt trước bàn ${dataTable?.tableNumber}`,
      );
    }
    const result = await this.ReservationModel.create(createReservationDto);

    return {
      _id: result._id,
      createdAt: result.createdAt,
    };
  }

  /** 📋 Lấy danh sách đặt bàn */
  async findAll(currentPage: number, limit: number, qs: string) {
    const { filter, sort, projection, population } = aqp(qs);
    delete filter.current;
    delete filter.pageSize;

    const offset = (currentPage - 1) * +limit;
    const defaultLimit = limit ? limit : 10;

    const totalItems = (await this.ReservationModel.find(filter)).length;
    const totalPages = Math.ceil(totalItems / defaultLimit);

    const result = await this.ReservationModel.find(filter)
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

  /** � Lấy tất cả đặt bàn có trạng thái 'upcoming' */
  async getPreBookedTable() {
    const result = await this.ReservationModel.find({
      status: { $in: ['upcoming', 'checked_in'] },
    });

    return result;
  }

  /** � Lấy tất cả đặt bàn có trạng thái 'upcoming' với phân trang */
  async getPreBookedTableUpComing(
    currentPage: number,
    limit: number,
    qs: string,
  ) {
    const { filter, sort, projection, population } = aqp(qs);
    delete filter.current;
    delete filter.pageSize;

    const offset = (currentPage - 1) * +limit;
    const defaultLimit = limit ? limit : 10;

    const finalFilter = {
      ...filter,
      status: 'upcoming',
    };

    const totalItems = (await this.ReservationModel.find(finalFilter)).length;
    const totalPages = Math.ceil(totalItems / defaultLimit);

    const result = await this.ReservationModel.find(finalFilter)
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

  async checkInTable(reservationId: string) {
    return await this.ReservationModel.findByIdAndUpdate(reservationId, {
      status: 'checked_in',
      checkInAt: new Date(),
    });
  }

  async cancelTableReservation(
    reservationId: string,
    date: string,
    timeSlot: string,
  ) {
    const reservationData = await this.ReservationModel.findById(reservationId);
    if (!reservationData) {
      throw new BadRequestException('Không có dữ liệu qua id bạn gửi!');
    }

    const keyRedis = `booking:${date}:${timeSlot}`;
    const idTable = reservationData.tableId;
    await this.reservationsGateway.handleCancelReservation(
      idTable.toString(),
      keyRedis,
    );

    return await this.ReservationModel.findByIdAndUpdate(reservationId, {
      status: 'cancelled',
      cancelledAt: new Date(),
    });
  }

  /** �🔍 Lấy chi tiết một đặt bàn */
  async findOne(id: string) {
    return await this.ReservationModel.findById(id);
  }

  /** ✏️ Cập nhật đặt bàn */
  async update(
    id: string,
    updateReservationDto: UpdateReservationDto,
    user: IUser,
  ) {
    return await this.ReservationModel.updateOne(
      { _id: id },
      {
        ...updateReservationDto,
        updatedBy: {
          _id: user._id,
          email: user.email,
        },
      },
    );
  }

  /** 🗑️ Xóa (mềm) đặt bàn */
  async remove(id: string, user: IUser) {
    await this.ReservationModel.updateOne(
      { _id: id },
      {
        deletedBy: {
          _id: user._id,
          email: user.email,
        },
      },
    );
    return await this.ReservationModel.softDelete({ _id: id });
  }

  async fetchReservationDataInStatus(status: string, customerPhone: string) {
    let result: any;
    if (status == 'upcoming') {
      result = await this.ReservationModel.find({
        status: status,
        customerPhone: customerPhone,
      });
    } else if (status == 'checked_in') {
      result = await this.ReservationModel.find({
        status: status,
        customerPhone: customerPhone,
      });
    } else if (status == 'cancelled-expired') {
      result = await this.ReservationModel.find({
        status: { $in: ['cancelled', 'expired'] },
        customerPhone: customerPhone,
      });
    }

    return result;
  }

  async validateReservation(date: string, timeSlot: string, tableId: string) {
    const existingReservations = await this.ReservationModel.findOne({
      date,
      timeSlot,
      tableId,
      status: 'upcoming',
    });
    return existingReservations ? 'yes' : 'no';
  }

  async summaryReservation(month: string, year: string) {
    const startDate = new Date(Number(year), Number(month) - 1, 1);
    const endDate = new Date(Number(year), Number(month), 1);

    const result = await this.ReservationModel.aggregate([
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

          totalReservations: { $sum: 1 },

          checkedIn: {
            $sum: {
              $cond: [{ $eq: ['$status', 'checked_in'] }, 1, 0],
            },
          },

          expired: {
            $sum: {
              $cond: [{ $eq: ['$status', 'expired'] }, 1, 0],
            },
          },

          cancelled: {
            $sum: {
              $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0],
            },
          },

          active: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$status', 'expired'] },
                    { $ne: ['$status', 'cancelled'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    return (
      result[0] || {
        totalReservations: 0,
        checkedIn: 0,
        expired: 0,
        cancelled: 0,
        active: 0,
      }
    );
  }

  async summaryReservationToday(date: string) {
    const data = await this.ReservationModel.find({ date })
      .populate({
        path: 'tableId',
        select: 'tableNumber',
      })
      .sort('-timeSlot');
    const dataMap = data.map((r) => ({
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      tableData: r.tableId,
      capacity: r.capacity,
      timeSlot: r.timeSlot,
      status: r.status,
    }));
    return dataMap;
  }
}
