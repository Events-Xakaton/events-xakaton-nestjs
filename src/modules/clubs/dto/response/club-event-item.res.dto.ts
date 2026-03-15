import { ApiProperty } from '@nestjs/swagger';
import { EventStatus } from '@prisma/client';

export class ClubEventItemResDto {
  @ApiProperty() readonly id: string;
  @ApiProperty() readonly title: string;
  @ApiProperty({ enum: EventStatus }) readonly status: EventStatus;
  @ApiProperty() readonly startsAtUtc: Date;
  @ApiProperty() readonly endsAtUtc: Date;
  @ApiProperty() readonly participantsCount: number;
  @ApiProperty({ nullable: true }) readonly freeSpots: number | null;
  @ApiProperty({
    nullable: true,
    description: 'Минимальный уровень участника (null — без ограничений)',
  })
  readonly minLevel: number | null;
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

  constructor(data: {
    id: string;
    title: string;
    status: EventStatus;
    startsAtUtc: Date;
    endsAtUtc: Date;
    participantsCount: number;
    freeSpots: number | null;
    minLevel: number | null;
    isForKids: boolean;
    kidsMinAge: number | null;
  }) {
    this.id = data.id;
    this.title = data.title;
    this.status = data.status;
    this.startsAtUtc = data.startsAtUtc;
    this.endsAtUtc = data.endsAtUtc;
    this.participantsCount = data.participantsCount;
    this.freeSpots = data.freeSpots;
    this.minLevel = data.minLevel;
    this.isForKids = data.isForKids;
    this.kidsMinAge = data.kidsMinAge;
  }
}
