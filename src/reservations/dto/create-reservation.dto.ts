import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsMongoId,
  IsIn,
} from 'class-validator';

export class CreateReservationDto {
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
  @IsNotEmpty({ message: 'peopleCount không được để trống' })
  peopleCount: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
