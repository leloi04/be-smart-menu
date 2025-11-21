import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from './bull-queue.constants';

@Injectable()
export class BullQueueService {
  constructor(
    @InjectQueue(QUEUE_NAMES.RESERVATION)
    private readonly reservationQueue: Queue,
  ) {}

  /** 🧩 Thêm job vào hàng đợi */
  async addMarkExpiredReservationsJob() {
    await this.reservationQueue.add(
      'markExpiredReservations',
      {},
      {
        repeat: { every: 5 * 60 * 1000 }, // ⏱ chạy mỗi 5 phút
        removeOnComplete: true,
      },
    );
  }
}
