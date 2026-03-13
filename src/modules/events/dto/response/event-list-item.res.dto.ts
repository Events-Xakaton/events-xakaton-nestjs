import { ApiProperty } from '@nestjs/swagger';

export class EventListItemResDto {
  @ApiProperty() readonly id: string;
  @ApiProperty() readonly title: string;
  @ApiProperty() readonly status: string;
  @ApiProperty() readonly startsAtUtc: Date;
  @ApiProperty() readonly participantsCount: number;
  @ApiProperty({ nullable: true }) readonly freeSpots: number | null;
  @ApiProperty({ nullable: true }) readonly coverSeed: string | null;
  @ApiProperty() readonly joinedByMe: boolean;
  @ApiProperty() readonly isOrganizer: boolean;

  constructor(data: {
    id: string;
    title: string;
    status: string;
    startsAtUtc: Date;
    participantsCount: number;
    freeSpots: number | null;
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
    this.coverSeed = data.coverSeed;
    this.joinedByMe = data.joinedByMe;
    this.isOrganizer = data.isOrganizer;
  }
}
