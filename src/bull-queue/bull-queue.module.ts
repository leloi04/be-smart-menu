import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BullQueueService } from './bull-queue.service';
import { BullQueueProcessor } from './bull-queue.processor';
import { QUEUE_NAMES } from './bull-queue.constants';
import { ReservationsModule } from 'src/reservations/reservations.module';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Reservation,
  ReservationSchema,
} from 'src/reservations/schemas/reservation.schema';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        // ✅ Ưu tiên REDIS_URL (Render / Production)
        ...(process.env.REDIS_URL
          ? { url: process.env.REDIS_URL }
          : {
              // ✅ Local fallback
              host: process.env.REDIS_HOST || '127.0.0.1',
              port: Number(process.env.REDIS_PORT) || 6379,
              password: process.env.REDIS_PASSWORD || undefined,
            }),
      },
    }),

    BullModule.registerQueue({
      name: QUEUE_NAMES.RESERVATION,
    }),

    MongooseModule.forFeature([
      { name: Reservation.name, schema: ReservationSchema },
    ]),
  ],
  providers: [BullQueueService, BullQueueProcessor],
  exports: [BullQueueService, BullModule],
})
export class BullQueueModule {}
