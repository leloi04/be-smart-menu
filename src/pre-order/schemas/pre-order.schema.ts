import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument, Types } from 'mongoose';
import { Menu } from 'src/menu/schemas/menu.schema';
import { User } from 'src/users/schemas/user.schema';

export type PreOrderDocument = HydratedDocument<PreOrder>;

@Schema({ timestamps: true })
export class PreOrder {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  customerId: Types.ObjectId;

  @Prop({
    type: [
      {
        kitchenArea: String,
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
    kitchenArea: string;
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
  }[];

  @Prop({ type: Number, required: true, default: 0 })
  totalItemPrice: number;

  @Prop({ type: Number, required: true, default: 0 })
  totalPayment: number;

  @Prop({ type: String, enum: ['pickup', 'ship'], required: true })
  method: 'pickup' | 'ship';

  @Prop({ type: String, required: false })
  deliveryAddress?: string;

  @Prop({ type: String, required: false })
  pickupTime?: string;

  @Prop({
    type: String,
    enum: ['unpaid', 'paid'],
    default: 'unpaid',
  })
  paymentStatus: 'unpaid' | 'paid';

  @Prop({
    type: [
      {
        status: {
          type: String,
          enum: [
            'pending',
            'confirmed',
            'preparing',
            'ready',
            'delivering',
            'cancelled',
            'completed',
          ],
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    default: [
      {
        status: 'pending',
        timestamp: new Date(),
      },
    ],
  })
  tracking: {
    status: string;
    timestamp: Date;
  }[];

  @Prop({
    type: String,
    enum: ['cod', 'bank'],
  })
  payment: 'cod' | 'bank';

  @Prop({ type: Types.ObjectId, ref: 'Payment', required: false })
  paymentId?: Types.ObjectId;

  @Prop({ type: String, default: '' })
  note?: string;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;

  @Prop()
  isDeleted: boolean;

  @Prop()
  deletedAt: Date;

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

export const PreOrderSchema = SchemaFactory.createForClass(PreOrder);
