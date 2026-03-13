import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

import { EventStatus } from '@shared/domain';

export class ListClubEventsReqDto {
  @ApiPropertyOptional({
    enum: [EventStatus.Upcoming, EventStatus.Ongoing, EventStatus.Past],
    default: EventStatus.Upcoming,
  })
  @IsOptional()
  @IsIn([EventStatus.Upcoming, EventStatus.Ongoing, EventStatus.Past])
  bucket?: EventStatus.Upcoming | EventStatus.Ongoing | EventStatus.Past;

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
