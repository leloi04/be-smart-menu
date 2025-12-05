import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { Table } from 'src/table/schemas/table.schema';
import { User } from 'src/users/schemas/user.schema';

export type ReservationDocument = HydratedDocument<Reservation>;

@Schema({ timestamps: true })
export class Reservation {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: User.name,
  })
  customerId?: mongoose.Schema.Types.ObjectId;

  @Prop()
  customerName: string;

  @Prop()
  customerPhone: string;

  @Prop()
  customerEmail?: string;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Table.name,
    required: true,
  })
  tableId: mongoose.Schema.Types.ObjectId;

  @Prop({ required: true })
  date: string; // "YYYY-MM-DD"

  @Prop({ required: true })
  timeSlot: string; // "HH:mm"

  @Prop({ required: true })
  capacity: number;

  @Prop({
    type: String,
    enum: ['upcoming', 'checked_in', 'cancelled', 'expired'],
    default: 'upcoming',
  })
  status: string;

  @Prop()
  note?: string;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;

  @Prop()
  isDeleted: boolean;

  @Prop()
  deletedAt: Date;

  @Prop()
  checkInAt?: Date;

  @Prop()
  cancelledAt?: Date;

  @Prop()
  expiredAt?: Date;

  @Prop({ type: Object })
  createdBy?: {
    _id: mongoose.Schema.Types.ObjectId;
    email: string;
  };

  @Prop({ type: Object })
  updatedBy?: {
    _id: mongoose.Schema.Types.ObjectId;
    email: string;
  };

  @Prop({ type: Object })
  deletedBy?: {
    _id: mongoose.Schema.Types.ObjectId;
    email: string;
  };
}

export const ReservationSchema = SchemaFactory.createForClass(Reservation);
