import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateEventReqDto {
  @ApiPropertyOptional({
    description: 'ID клуба (если событие привязано к клубу)',
  })
  @IsOptional()
  @IsString()
  clubId?: string;

  @ApiProperty({ description: 'Название события', maxLength: 60 })
  @IsString()
  @MaxLength(60)
  title!: string;

  @ApiProperty({ description: 'Описание события', maxLength: 1000 })
  @IsString()
  @MaxLength(1000)
  description!: string;

  @ApiProperty({ description: 'Место проведения или ссылка' })
  @IsString()
  locationOrLink!: string;

  @ApiProperty({ description: 'Дата начала (ISO 8601 UTC)' })
  @IsDateString()
  startsAtUtc!: string;

  @ApiProperty({ description: 'Дата окончания (ISO 8601 UTC)' })
  @IsDateString()
  endsAtUtc!: string;

  @ApiPropertyOptional({
    description: 'Максимальное число участников',
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxParticipants?: number;

  @ApiPropertyOptional({
    description:
      'Минимальный уровень участника (1–10). null — без ограничений.',
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  minLevel?: number;

  @ApiPropertyOptional({
    description: 'Признак детского ивента',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isForKids?: boolean;

  @ApiPropertyOptional({
    description:
      'Минимальный возраст ребенка (N+). null/undefined — без уточнения.',
    minimum: 0,
    maximum: 17,
    nullable: true,
  })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(0)
  @Max(17)
  kidsMinAge?: number | null;

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

  @ApiPropertyOptional({
    description: 'URL загруженного баннера (из POST /upload/banner)',
    nullable: true,
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
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
