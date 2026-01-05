import {
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreatePromotionDto {
  @IsString()
  @IsNotEmpty({ message: 'title không được để trống' })
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'description không được để trống' })
  description: string;

  @IsNotEmpty({ message: 'imageUrl không được để trống' })
  imageUrl: string;

  @IsNotEmpty({ message: 'linkType không được để trống' })
  linkType: string;

  @IsOptional()
  linkValue?: string;

  @IsOptional()
  status?: boolean;

  @IsOptional()
  displayMode?: string;

  @IsString()
  @IsNotEmpty({ message: 'startAt không được để trống' })
  startAt: string;

  @IsString()
  @IsNotEmpty({ message: 'endAt không được để trống' })
  endAt: string;
}
