import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListClubEventsReqDto {
  @ApiPropertyOptional({
    enum: ['upcoming', 'ongoing', 'past'],
    default: 'upcoming',
  })
  @IsOptional()
  @IsIn(['upcoming', 'ongoing', 'past'])
  bucket?: 'upcoming' | 'ongoing' | 'past';

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 8, minimum: 1, maximum: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}
