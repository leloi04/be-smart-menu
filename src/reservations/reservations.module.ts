import { Module } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { ReservationsController } from './reservations.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Reservation, ReservationSchema } from './schemas/reservation.schema';
import { Table, TableSchema } from 'src/table/schemas/table.schema';
import { User, UserSchema } from 'src/users/schemas/user.schema';
import { BullQueueModule } from 'src/bull-queue/bull-queue.module';
import { ReservationsGateway } from './reservations.gateway';

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
  providers: [ReservationsService, ReservationsGateway],
  exports: [ReservationsService, ReservationsGateway, MongooseModule],
})
export class ReservationsModule {}
