import { ApiProperty } from '@nestjs/swagger';

import { ClubEventItemResDto } from './club-event-item.res.dto';

export class ClubEventsPageResDto {
  @ApiProperty({ enum: ['upcoming', 'ongoing', 'past'] }) readonly bucket:
    | 'upcoming'
    | 'ongoing'
    | 'past';
  @ApiProperty() readonly page: number;
  @ApiProperty() readonly limit: number;
  @ApiProperty() readonly hasMore: boolean;
  @ApiProperty() readonly total: number;
  @ApiProperty({ type: [ClubEventItemResDto] })
  readonly items: ClubEventItemResDto[];

  constructor(data: {
    bucket: 'upcoming' | 'ongoing' | 'past';
    page: number;
    limit: number;
    hasMore: boolean;
    total: number;
    items: ClubEventItemResDto[];
  }) {
    this.bucket = data.bucket;
    this.page = data.page;
    this.limit = data.limit;
    this.hasMore = data.hasMore;
    this.total = data.total;
    this.items = data.items;
  }
}
