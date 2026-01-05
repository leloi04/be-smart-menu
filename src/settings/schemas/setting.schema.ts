import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';

export type SettingDocument = HydratedDocument<Setting>;

@Schema({ timestamps: true })
export class Setting {
  @Prop()
  name: string;

  @Prop()
  address: string;

  @Prop()
  phone: string;

  @Prop()
  email: string;

  @Prop()
  description: string;

  @Prop()
  logo: string;

  @Prop({
    type: {
      enabled: Boolean,
      open: String,
      close: String,
    },
  })
  weekday: {
    enabled: boolean;
    open: string;
    close: string;
  };

  @Prop({
    type: {
      enabled: Boolean,
      open: String,
      close: String,
    },
  })
  weekend: {
    enabled: boolean;
    open: string;
    close: string;
  };

  @Prop()
  slotDurationMinutes: number;

  @Prop()
  startOffsetMinutes: number;

  @Prop()
  endOfDayTime: string;

  @Prop({ default: true })
  lockOrderAfterClose: boolean;

  @Prop({ default: false })
  allowCrossShiftOrder: boolean;

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

export const SettingSchema = SchemaFactory.createForClass(Setting);
