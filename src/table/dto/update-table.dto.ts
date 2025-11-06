import { PartialType } from '@nestjs/mapped-types';
import { CreateTableDto } from './create-table.dto';
import { IsEnum, IsOptional } from 'class-validator';
import mongoose from 'mongoose';

export class UpdateTableDto extends PartialType(CreateTableDto) {
  @IsOptional()
  isChangeQrCode: boolean;

  @IsEnum(['empty', 'occupied', 'cleaning'])
  @IsOptional()
  status: string;

  @IsOptional()
  currentOrder: mongoose.Schema.Types.ObjectId | null;
}
