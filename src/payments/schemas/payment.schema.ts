import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { Menu } from 'src/menu/schemas/menu.schema';
import { Order } from 'src/order/schemas/order.schema';
import { User } from 'src/users/schemas/user.schema';

export type PaymentDocument = HydratedDocument<Payment>;

@Schema({ timestamps: true })
export class Payment {
  @Prop({ Type: mongoose.Schema.Types.ObjectId, ref: Order.name })
  orderId: string;

  @Prop({ enum: ['cash', 'vnpay'] })
  method: string;

  @Prop()
  amount: number;

  @Prop()
  transactionCode: string;

  @Prop({
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
  })
  status: string;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;

  @Prop()
  isDeleted: boolean;

  @Prop()
  deletedAt: Date;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
