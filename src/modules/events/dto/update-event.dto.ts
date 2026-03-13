import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateEventDto {
  @ApiPropertyOptional({ description: 'Название события', maxLength: 60 })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  title?: string;

  @ApiPropertyOptional({ description: 'Описание события', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ description: 'Место проведения или ссылка' })
  @IsOptional()
  @IsString()
  locationOrLink?: string;

  @ApiPropertyOptional({ description: 'Дата начала (ISO 8601 UTC)' })
  @IsOptional()
  @IsDateString()
  startsAtUtc?: string;

  @ApiPropertyOptional({ description: 'Дата окончания (ISO 8601 UTC)' })
  @IsOptional()
  @IsDateString()
  endsAtUtc?: string;

  @ApiPropertyOptional({
    description: 'Максимальное число участников',
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxParticipants?: number;

  @ApiPropertyOptional({
    description: 'Seed для генерации обложки',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  coverSeed?: string;

  @ApiPropertyOptional({
    description: 'ID клуба (null — отвязать от клуба)',
    nullable: true,
  })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(64)
  clubId?: string | null;
}
