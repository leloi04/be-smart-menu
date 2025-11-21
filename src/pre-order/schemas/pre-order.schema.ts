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

  @Prop({ type: Number, required: true, default: 0 })
  totalAmount: number;

  @Prop({ type: String, enum: ['pickup', 'delivery'], required: true })
  method: 'pickup' | 'delivery';

  @Prop({ type: String, required: false })
  deliveryAddress?: string;

  @Prop({ type: Date, required: false })
  pickupTime?: Date;

  @Prop({
    type: String,
    enum: ['pending', 'paid', 'processing', 'completed', 'cancelled'],
    default: 'pending',
  })
  status: 'pending' | 'paid' | 'processing' | 'completed' | 'cancelled';

  @Prop({ type: Types.ObjectId, ref: 'Payment', required: false })
  paymentId?: Types.ObjectId;

  @Prop({ type: String, default: '' })
  note?: string;
}

export const PreOrderSchema = SchemaFactory.createForClass(PreOrder);
