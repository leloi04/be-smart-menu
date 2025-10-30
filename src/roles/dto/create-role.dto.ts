import { IsArray, IsBoolean, IsMongoId, IsNotEmpty } from 'class-validator';
import mongoose from 'mongoose';

export class CreateRoleDto {
  @IsNotEmpty({ message: 'name khong duoc de trong' })
  name: string;

  @IsNotEmpty({ message: 'description khong duoc de trong' })
  description: string;

  @IsBoolean({ message: 'isActive khong dung dinh dang' })
  @IsNotEmpty({ message: 'isActive khong duoc de trong' })
  isActive: string;

  @IsMongoId({ each: true, message: 'permissions co moi phan tu la objectId' })
  @IsArray({ message: 'permissions co dinh dang la array' })
  @IsNotEmpty({ message: 'permission khong duoc de trong' })
  permissions: mongoose.Schema.Types.ObjectId[];
}
