import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateClubReqDto {
  @ApiProperty({ description: 'Название клуба', maxLength: 60 })
  @IsString()
  @MaxLength(60)
  title!: string;

  @ApiProperty({ description: 'Описание клуба', maxLength: 1000 })
  @IsString()
  @MaxLength(1000)
  description!: string;

  @ApiProperty({ description: 'Код категории' })
  @IsString()
  categoryCode!: string;

  @ApiPropertyOptional({ description: 'Теги (максимум 3)', type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @MaxLength(10, { each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'URL обложки' })
  @IsOptional()
  @IsString()
  coverUrl?: string;

  @ApiPropertyOptional({
    description: 'Seed для генерации обложки',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  coverSeed?: string;
}
