import { ApiProperty } from '@nestjs/swagger';

import { EventStatus } from '@shared/domain';

export class EventDetailResDto {
  @ApiProperty() readonly id: string;
  @ApiProperty() readonly title: string;
  @ApiProperty() readonly description: string;
  @ApiProperty() readonly locationOrLink: string;
  @ApiProperty({ enum: EventStatus }) readonly status: EventStatus;
  @ApiProperty() readonly startsAtUtc: Date;
  @ApiProperty() readonly endsAtUtc: Date;
  @ApiProperty({ nullable: true }) readonly maxParticipants: number | null;
  @ApiProperty({ nullable: true, description: 'Минимальный уровень участника (null — без ограничений)' }) readonly minLevel: number | null;
  @ApiProperty() readonly participantsCount: number;
  @ApiProperty({ nullable: true }) readonly freeSpots: number | null;
  @ApiProperty() readonly creatorTelegramUserId: string;
  @ApiProperty() readonly creatorName: string;
  @ApiProperty({ nullable: true }) readonly clubId: string | null;
  @ApiProperty({ nullable: true }) readonly clubTitle: string | null;
  @ApiProperty({ type: [String] }) readonly tags: string[];
  @ApiProperty({ nullable: true }) readonly coverSeed: string | null;
  @ApiProperty() readonly joinedByMe: boolean;
  @ApiProperty() readonly canManage: boolean;
  @ApiProperty({ description: 'Организатор уже подтвердил присутствие участников' })
  readonly attendanceConfirmed: boolean;

  constructor(data: {
    id: string;
    title: string;
    description: string;
    locationOrLink: string;
    status: EventStatus;
    startsAtUtc: Date;
    endsAtUtc: Date;
    maxParticipants: number | null;
    minLevel: number | null;
    participantsCount: number;
    freeSpots: number | null;
    creatorTelegramUserId: string;
    creatorName: string;
    clubId: string | null;
    clubTitle: string | null;
    tags: string[];
    coverSeed: string | null;
    joinedByMe: boolean;
    canManage: boolean;
    attendanceConfirmed: boolean;
  }) {
    this.id = data.id;
    this.title = data.title;
    this.description = data.description;
    this.locationOrLink = data.locationOrLink;
    this.status = data.status;
    this.startsAtUtc = data.startsAtUtc;
    this.endsAtUtc = data.endsAtUtc;
    this.maxParticipants = data.maxParticipants;
    this.minLevel = data.minLevel;
    this.participantsCount = data.participantsCount;
    this.freeSpots = data.freeSpots;
    this.creatorTelegramUserId = data.creatorTelegramUserId;
    this.creatorName = data.creatorName;
    this.clubId = data.clubId;
    this.clubTitle = data.clubTitle;
    this.tags = data.tags;
    this.coverSeed = data.coverSeed;
    this.joinedByMe = data.joinedByMe;
    this.canManage = data.canManage;
    this.attendanceConfirmed = data.attendanceConfirmed;
  }
}
