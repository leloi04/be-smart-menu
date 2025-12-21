import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsMongoId,
  ValidateNested,
  IsArray,
} from 'class-validator';
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
  @IsString()
  kitchenArea: string;

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
}

export class CreatePreOrderDto {
  @IsMongoId()
  @IsNotEmpty({ message: 'customerId không được để trống' })
  customerId: mongoose.Schema.Types.ObjectId;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  orderItems: OrderItemDto[];

  @IsNotEmpty({ message: 'totalItemPrice không được để trống' })
  totalItemPrice: number;

  @IsNotEmpty({ message: 'totalPayment không được để trống' })
  totalPayment: number;

  @IsNotEmpty({ message: 'method không được để trống' })
  method: string;

  @IsNotEmpty({ message: 'payment không được để trống' })
  payment: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @IsOptional()
  @IsString()
  pickupTime?: string;

  @IsOptional()
  @IsString()
  tracking?: string;
}
