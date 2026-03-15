import { ApiProperty } from '@nestjs/swagger';

import { EventStatus } from '@shared/domain';

export class EventListItemResDto {
  @ApiProperty() readonly id: string;
  @ApiProperty() readonly title: string;
  @ApiProperty({ enum: EventStatus }) readonly status: EventStatus;
  @ApiProperty() readonly startsAtUtc: Date;
  @ApiProperty() readonly endsAtUtc: Date;
  @ApiProperty() readonly participantsCount: number;
  @ApiProperty({ nullable: true }) readonly freeSpots: number | null;
  @ApiProperty({ nullable: true }) readonly minLevel: number | null;
  @ApiProperty({ nullable: true }) readonly coverUrl: string | null;
  @ApiProperty({ nullable: true }) readonly coverSeed: string | null;
  @ApiProperty({
    description: 'Ивент подходит для посещения с детьми',
  })
  readonly isForKids: boolean;
  @ApiProperty({
    nullable: true,
    description:
      'Минимальный возраст ребенка (N+). null — без уточнения возраста.',
  })
  readonly kidsMinAge: number | null;
  @ApiProperty() readonly joinedByMe: boolean;
  @ApiProperty() readonly isOrganizer: boolean;

  constructor(data: {
    id: string;
    title: string;
    status: EventStatus;
    startsAtUtc: Date;
    endsAtUtc: Date;
    participantsCount: number;
    freeSpots: number | null;
    minLevel: number | null;
    coverUrl: string | null;
    coverSeed: string | null;
    isForKids: boolean;
    kidsMinAge: number | null;
    joinedByMe: boolean;
    isOrganizer: boolean;
  }) {
    this.id = data.id;
    this.title = data.title;
    this.status = data.status;
    this.startsAtUtc = data.startsAtUtc;
    this.endsAtUtc = data.endsAtUtc;
    this.participantsCount = data.participantsCount;
    this.freeSpots = data.freeSpots;
    this.minLevel = data.minLevel;
    this.coverUrl = data.coverUrl;
    this.coverSeed = data.coverSeed;
    this.isForKids = data.isForKids;
    this.kidsMinAge = data.kidsMinAge;
    this.joinedByMe = data.joinedByMe;
    this.isOrganizer = data.isOrganizer;
  }
}
