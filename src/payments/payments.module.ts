import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { OrderModule } from 'src/order/order.module';
import { Order, OrderSchema } from 'src/order/schemas/order.schema';
import { Table, TableSchema } from 'src/table/schemas/table.schema';
import { TableModule } from 'src/table/table.module';
import {
  PreOrder,
  PreOrderSchema,
} from 'src/pre-order/schemas/pre-order.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Table.name, schema: TableSchema },
      { name: PreOrder.name, schema: PreOrderSchema },
    ]),
    OrderModule,
    TableModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
