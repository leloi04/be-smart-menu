import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsMongoId,
  IsNotEmpty,
  IsNotEmptyObject,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import mongoose from 'mongoose';

export class CreateUserDto {
  @IsNotEmpty({ message: 'name không được để trống' })
  name: string;

  @IsEmail({}, { message: 'email không đúng định dạng' })
  @IsNotEmpty({ message: 'email không được để trống' })
  email: string;

  @IsNotEmpty({ message: 'password không được để trống' })
  password: string;

  @IsNotEmpty({ message: 'phone không được để trống' })
  phone: number;

  @IsOptional()
  gender?: string;

  @IsOptional()
  avatar?: string;

  @IsMongoId({ message: 'phần tử là objectId' })
  @IsOptional()
  role?: mongoose.Schema.Types.ObjectId;
}

export class RegisterUserDto {
  @IsNotEmpty({ message: 'name không được để trống' })
  name: string;

  @IsEmail({}, { message: 'email không đúng định dạng' })
  @IsNotEmpty({ message: 'email không được để trống' })
  email: string;

  @IsNotEmpty({ message: 'password không được để trống' })
  password: string;

  @IsNotEmpty({ message: 'phone không được để trống' })
  phone: string;

  role: string;
}
