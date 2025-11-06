import { IsNotEmpty, IsOptional } from 'class-validator';

export class CreateTableDto {
  @IsNotEmpty({ message: 'tableNumber không được để trống' })
  tableNumber: string;

  @IsNotEmpty({ message: 'descriptionPosition không được để trống' })
  descriptionPosition: string;

  @IsNotEmpty({ message: 'seats không được để trống' })
  seats: number;
}
