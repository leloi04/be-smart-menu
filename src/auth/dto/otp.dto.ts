import {
  IsEnum,
  IsNotEmpty,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

export class SendOtpDto {
  @IsString()
  @IsNotEmpty()
  value: string;
}

export class VerifyOtpDto {
  @IsString()
  value: string;

  @IsString()
  @Length(6, 6)
  otp: string;
}

export class ResetPasswordDto {
  @IsString()
  value: string;

  @IsString()
  @MinLength(6)
  password: string;
}
