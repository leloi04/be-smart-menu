import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';

export type PromotionDocument = HydratedDocument<Promotion>;

@Schema({ timestamps: true })
export class Promotion {
  @Prop()
  title: string;

  @Prop()
  description: string;

  @Prop()
  imageUrl: string;

  @Prop({
    type: String,
    enum: ['INTERNAL', 'EXTERNAL', 'NONE'],
    default: 'NONE',
  })
  linkType: string;

  @Prop()
  linkValue: string;

  @Prop({
    type: String,
    enum: ['MANUAL', 'AUTO'],
    default: 'MANUAL',
  })
  displayMode: string;

  @Prop({ default: true })
  status: boolean;

  @Prop({ default: 0 })
  order: number;

  @Prop()
  startAt: string;

  @Prop()
  endAt: string;

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

export const PromotionSchema = SchemaFactory.createForClass(Promotion);
