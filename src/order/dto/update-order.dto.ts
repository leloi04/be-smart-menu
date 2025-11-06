import { PartialType } from '@nestjs/mapped-types';
import { CreateOrderDto } from './create-order.dto';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateOrderDto extends PartialType(CreateOrderDto) {
  @IsEnum(['pending_confirmation', 'processing', 'completed', 'draft'])
  @IsOptional()
  progressStatus?: string;

  @IsEnum(['unpaid', 'paid'])
  @IsOptional()
  paymentStatus?: string;
}
