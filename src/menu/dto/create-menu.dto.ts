import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsEnum,
  IsNotEmpty,
} from 'class-validator';

export class CreateMenuDto {
  @IsString()
  @IsNotEmpty({ message: 'name không được để trống' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'description không được để trống' })
  description: string;

  @IsArray()
  @IsNotEmpty({ message: 'ingredients không được để trống' })
  ingredients: string[];

  @IsNumber()
  @IsNotEmpty({ message: 'price không được để trống' })
  price: number;

  @IsString()
  @IsNotEmpty({ message: 'image không được để trống' })
  image: string;

  @IsString()
  @IsNotEmpty({ message: 'category không được để trống' })
  category: string;

  @IsOptional()
  @IsEnum(['available', 'out_of_stock'])
  status?: string;

  @IsOptional()
  variants?: { size: string; price: number }[];

  @IsOptional()
  toppings?: { name: string; price: number }[];
}
