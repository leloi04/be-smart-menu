import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';

export type MenuDocument = HydratedDocument<Menu>;

@Schema({ timestamps: true })
export class Menu {
  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop([String])
  ingredients: string[];

  @Prop({ required: true })
  price: number;

  @Prop()
  image: string;

  @Prop()
  category: string;

  @Prop({ enum: ['available', 'out_of_stock'], default: 'available' })
  status: string;

  @Prop({ default: 0 })
  averageRating: number;

  @Prop({ type: [{ size: String, price: Number }] })
  variants: { size: string; price: number }[];

  @Prop({ type: [{ name: String, price: Number }] })
  toppings: { name: string; price: number }[];

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

export const MenuSchema = SchemaFactory.createForClass(Menu);
