import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class UpdateUserDto extends OmitType(CreateUserDto, [
  'password',
] as const) {
  _id: string;
}

export class UpdateUserPassword {
  @IsEmail({}, { message: 'email khong dung dinh dang' })
  @IsNotEmpty({ message: 'email khong duoc de trong' })
  email: string;

  @IsNotEmpty({ message: 'oldPassword khong duoc de trong' })
  oldPassword: string;

  @IsNotEmpty({ message: 'newPassword khong duoc de trong' })
  newPassword: string;
}
