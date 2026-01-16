import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { QUEUE_NAMES } from './bull-queue.constants';
import { Logger } from '@nestjs/common';
import {
  Reservation,
  ReservationDocument,
} from 'src/reservations/schemas/reservation.schema';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

@Processor(QUEUE_NAMES.RESERVATION)
export class BullQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(BullQueueProcessor.name);

  constructor(
    @InjectModel(Reservation.name)
    private ReservationModel: SoftDeleteModel<ReservationDocument>,
  ) {
    super();
  }

  /** 🕒 Xử lý job “markExpiredReservations” */
  async process(job: Job): Promise<void> {
    if (job.name === 'markExpiredReservations') {
      const now = dayjs().tz('Asia/Ho_Chi_Minh');
      const today = now.format('YYYY-MM-DD');
      const currentTime = now.format('HH:mm');

      const result = await this.ReservationModel.updateMany(
        {
          date: today,
          timeSlot: { $lt: currentTime },
          status: 'upcoming',
        },
        {
          $set: {
            status: 'expired',
            expiredAt: new Date(),
          },
        },
      );

      if (result.modifiedCount > 0) {
        this.logger.log(
          `✅ Đã đánh dấu ${result.modifiedCount} đặt bàn hết hạn.`,
        );
      } else {
        this.logger.debug('⏳ Không có đặt bàn nào hết hạn.');
      }
    }
  }
}
