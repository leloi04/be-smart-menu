import { IsMongoId, IsNotEmpty, IsOptional } from 'class-validator';
import mongoose from 'mongoose';

export class CreateReviewDto {
  @IsNotEmpty({ message: 'type khong duoc de trong' })
  type: string;

  @IsNotEmpty({ message: 'user khong duoc de trong' })
  user: string;

  @IsNotEmpty({ message: 'rating khong duoc de trong' })
  rating: number;

  @IsNotEmpty({ message: 'comment khong duoc de trong' })
  comment: string;

  @IsMongoId({ message: 'menuItemId co phan tu la objectId' })
  @IsOptional()
  menuItemId?: mongoose.Schema.Types.ObjectId;
}
