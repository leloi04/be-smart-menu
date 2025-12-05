import { Module } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { ReservationsController } from './reservations.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Reservation, ReservationSchema } from './schemas/reservation.schema';
import { Table, TableSchema } from 'src/table/schemas/table.schema';
import { User, UserSchema } from 'src/users/schemas/user.schema';
import { BullQueueModule } from 'src/bull-queue/bull-queue.module';
import { ReservationsGateway } from './reservations.gateway';
import { RedisService } from 'src/redis-cache/redis-cache.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Reservation.name, schema: ReservationSchema },
      { name: Table.name, schema: TableSchema },
      { name: User.name, schema: UserSchema },
    ]),
    BullQueueModule,
  ],
  controllers: [ReservationsController],
  providers: [ReservationsService, ReservationsGateway, RedisService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
