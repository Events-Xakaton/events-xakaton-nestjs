import { ApiProperty } from '@nestjs/swagger';

import { EventStatus } from '@shared/domain';

export class EventListItemResDto {
  @ApiProperty() readonly id: string;
  @ApiProperty() readonly title: string;
  @ApiProperty({ enum: EventStatus }) readonly status: EventStatus;
  @ApiProperty() readonly startsAtUtc: Date;
  @ApiProperty() readonly participantsCount: number;
  @ApiProperty({ nullable: true }) readonly freeSpots: number | null;
  @ApiProperty({ nullable: true }) readonly minLevel: number | null;
  @ApiProperty({ nullable: true }) readonly coverSeed: string | null;
  @ApiProperty() readonly joinedByMe: boolean;
  @ApiProperty() readonly isOrganizer: boolean;

  constructor(data: {
    id: string;
    title: string;
    status: EventStatus;
    startsAtUtc: Date;
    participantsCount: number;
    freeSpots: number | null;
    minLevel: number | null;
    coverSeed: string | null;
    joinedByMe: boolean;
    isOrganizer: boolean;
  }) {
    this.id = data.id;
    this.title = data.title;
    this.status = data.status;
    this.startsAtUtc = data.startsAtUtc;
    this.participantsCount = data.participantsCount;
    this.freeSpots = data.freeSpots;
    this.minLevel = data.minLevel;
    this.coverSeed = data.coverSeed;
    this.joinedByMe = data.joinedByMe;
    this.isOrganizer = data.isOrganizer;
  }
}
