import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { Order } from 'src/order/schemas/order.schema';

export type TableDocument = HydratedDocument<Table>;

@Schema({ timestamps: true })
export class Table {
  @Prop({ required: true, unique: true })
  tableNumber: string;

  @Prop()
  descriptionPosition: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Order.name,
    default: null,
  })
  currentOrder: mongoose.Schema.Types.ObjectId;

  @Prop()
  token: string;

  @Prop()
  seats: number;

  @Prop({ enum: ['empty', 'occupied', 'cleaning'], default: 'empty' })
  status: string;

  @Prop()
  isChangeQrCode: boolean;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;

  @Prop()
  isDeleted: boolean;

  @Prop()
  deletedAt: Date;

  @Prop({ type: Object })
  createdBy: {
    _id: mongoose.Schema.Types.ObjectId;
    email: string;
  };

  @Prop({ type: Object })
  updatedBy: {
    _id: mongoose.Schema.Types.ObjectId;
    email: string;
  };

  @Prop({ type: Object })
  deletedBy: {
    _id: mongoose.Schema.Types.ObjectId;
    email: string;
  };
}

export const TableSchema = SchemaFactory.createForClass(Table);
