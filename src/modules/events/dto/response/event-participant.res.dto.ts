import { ApiProperty } from '@nestjs/swagger';

import { RankInfoDto } from '@modules/gamification/dto/response';

export class EventParticipantResDto {
  @ApiProperty() readonly telegramUserId: string;
  @ApiProperty() readonly fullName: string;
  @ApiProperty({ nullable: true }) readonly avatarUrl: string | null;
  @ApiProperty() readonly followedByMe: boolean;
  @ApiProperty({ type: RankInfoDto }) readonly rankInfo: RankInfoDto;

  @ApiProperty({
    nullable: true,
    description:
      'Оценка от организатора (1–5). null — не выставлена или посещение не подтверждено',
  })
  readonly rating: number | null;

  @ApiProperty({
    description: 'true — организатор подтвердил посещение данного участника',
  })
  readonly attendanceConfirmed: boolean;

  constructor(data: {
    telegramUserId: string;
    fullName: string;
    avatarUrl: string | null;
    followedByMe: boolean;
    rankInfo: RankInfoDto;
    rating: number | null;
    attendanceConfirmed: boolean;
  }) {
    this.telegramUserId = data.telegramUserId;
    this.fullName = data.fullName;
    this.avatarUrl = data.avatarUrl;
    this.followedByMe = data.followedByMe;
    this.rankInfo = data.rankInfo;
    this.rating = data.rating;
    this.attendanceConfirmed = data.attendanceConfirmed;
  }
}
