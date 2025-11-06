import {
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  IsString,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import mongoose from 'mongoose';

// ✅ DTO cho topping
class ToppingDto {
  @IsMongoId()
  _id: mongoose.Schema.Types.ObjectId;

  @IsString()
  name: string;

  @IsNumber()
  price: number;
}

// ✅ DTO cho variant
class VariantDto {
  @IsMongoId()
  _id: mongoose.Schema.Types.ObjectId;

  @IsString()
  size: string;

  @IsNumber()
  price: number;
}

// ✅ DTO cho từng món trong order
class OrderItemDto {
  @IsMongoId()
  menuItemId: mongoose.Schema.Types.ObjectId;

  @IsString()
  name: string;

  @IsNumber()
  quantity: number;

  @ValidateNested()
  @Type(() => VariantDto)
  @IsOptional()
  variant?: VariantDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ToppingDto)
  @IsOptional()
  toppings?: ToppingDto[];

  @IsOptional()
  @IsString()
  note?: string;
}

// ✅ DTO chính của Order
export class CreateOrderDto {
  @IsMongoId({ message: 'tableId phải là một MongoId hợp lệ' })
  @IsNotEmpty({ message: 'tableId không được để trống' })
  tableId: mongoose.Schema.Types.ObjectId;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  orderItems: OrderItemDto[];

  @IsNumber()
  totalPrice: number;
}
