import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { Menu } from 'src/menu/schemas/menu.schema';
import { User } from 'src/users/schemas/user.schema';

export type OrderDocument = HydratedDocument<Order>;

@Schema({ timestamps: true })
export class Order {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Table',
    required: true,
  })
  tableId: mongoose.Schema.Types.ObjectId;

  @Prop({
    type: [
      {
        userId: {
          type: mongoose.Schema.Types.Mixed,
          ref: User.name,
          default: null,
        },
        name: { type: String, default: 'Khách' },
        isGuest: { type: Boolean, default: false },
      },
    ],
    default: [],
  })
  customers: {
    userId?: mongoose.Schema.Types.ObjectId | string | null;
    name?: string;
    isGuest: boolean;
  }[];

  @Prop({
    type: [
      {
        menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: Menu.name },
        name: String,
        quantity: Number,
        variant: {
          _id: mongoose.Schema.Types.ObjectId,
          size: String,
          price: Number,
        },
        toppings: [
          {
            _id: mongoose.Schema.Types.ObjectId,
            name: String,
            price: Number,
          },
        ],
        note: String,
      },
    ],
    default: [],
  })
  orderItems: {
    menuItemId: mongoose.Schema.Types.ObjectId;
    name: string;
    quantity: number;
    variant: {
      _id: mongoose.Schema.Types.ObjectId;
      size: string;
      price: number;
    };
    toppings: {
      _id: mongoose.Schema.Types.ObjectId;
      name: string;
      price: number;
    }[];
    note?: string;
  }[];

  @Prop({ default: 0 })
  totalPrice: number;

  @Prop({ enum: ['unpaid', 'paid'], default: 'unpaid' })
  paymentStatus: string;

  @Prop({
    enum: ['draft', 'pending_confirmation', 'processing', 'completed'],
    default: 'draft',
  })
  progressStatus: string;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;

  @Prop()
  isDeleted: boolean;

  @Prop()
  deletedAt: Date;

  @Prop({ type: Object })
  deletedBy?: {
    _id: mongoose.Schema.Types.ObjectId;
    email: string;
  };
}

export const OrderSchema = SchemaFactory.createForClass(Order);
