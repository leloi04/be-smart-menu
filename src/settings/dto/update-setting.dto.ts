import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class OpeningHourDto {
  @IsBoolean()
  enabled: boolean;

  @IsString()
  open: string;

  @IsString()
  close: string;
}

export class UpsertSettingDto {
  /* Restaurant info */
  @IsString()
  name: string;

  @IsString()
  address: string;

  @IsString()
  phone: string;

  @IsString()
  email: string;

  @IsOptional()
  @IsString()
  description?: string;

  /* Opening hours */
  @ValidateNested()
  @Type(() => OpeningHourDto)
  weekday: OpeningHourDto;

  @ValidateNested()
  @Type(() => OpeningHourDto)
  weekend: OpeningHourDto;

  @IsString()
  logo: string;

  /* Shift */
  @IsNumber()
  slotDurationMinutes: number;

  @IsNumber()
  startOffsetMinutes: number;

  /* Operation */
  @IsString()
  endOfDayTime: string;

  @IsBoolean()
  lockOrderAfterClose: boolean;

  @IsBoolean()
  allowCrossShiftOrder: boolean;
}
