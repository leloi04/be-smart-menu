import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsMongoId,
  IsIn,
} from 'class-validator';

export class CreateReservationDto {
  @IsString()
  @IsNotEmpty({ message: 'customerName không được để trống' })
  customerName: string;

  @IsString()
  @IsNotEmpty({ message: 'customerPhone không được để trống' })
  customerPhone: string;

  @IsMongoId()
  @IsNotEmpty({ message: 'tableId không được để trống' })
  tableId: string;

  @IsString()
  @IsNotEmpty({ message: 'date không được để trống' })
  date: string; // "YYYY-MM-DD"

  @IsString()
  @IsNotEmpty({ message: 'timeSlot không được để trống' })
  timeSlot: string; // "HH:mm"

  @IsNumber()
  @IsNotEmpty({ message: 'capacity không được để trống' })
  capacity: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  tableNumber?: string;
}
