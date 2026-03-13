import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListNotificationsDto {
  @ApiPropertyOptional({
    description: 'Фильтр',
    enum: ['all', 'unread'],
    default: 'all',
  })
  @IsOptional()
  @IsIn(['all', 'unread'])
  filter?: 'all' | 'unread' = 'all';

  @ApiPropertyOptional({
    description: 'Лимит (1-20)',
    minimum: 1,
    maximum: 20,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Cursor-пагинация (ISO 8601 дата последней записи)',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}
