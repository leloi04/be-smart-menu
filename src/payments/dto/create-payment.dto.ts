import { IsEnum, IsMongoId, IsNotEmpty, IsOptional } from 'class-validator';
import mongoose from 'mongoose';

export class CreatePaymentDto {
  @IsMongoId({ message: 'orderId phải là một MongoId hợp lệ' })
  @IsNotEmpty({ message: 'orderId không được để trống' })
  orderId: mongoose.Schema.Types.ObjectId;

  @IsNotEmpty({ message: 'method không được để trống' })
  @IsEnum(['cash', 'vnpay'])
  method: string;

  @IsNotEmpty({ message: 'amount không được để trống' })
  amount: number;

  @IsEnum(['pending', 'completed', 'failed'])
  @IsOptional()
  status?: string;

  @IsOptional()
  transactionCode?: string;
}
