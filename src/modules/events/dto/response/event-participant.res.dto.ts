import { ApiProperty } from '@nestjs/swagger';

import { RankInfoDto } from '@modules/gamification/dto/response';

export class EventParticipantResDto {
  @ApiProperty() readonly telegramUserId: string;
  @ApiProperty() readonly fullName: string;
  @ApiProperty({ nullable: true }) readonly avatarUrl: string | null;
  @ApiProperty() readonly followedByMe: boolean;
  @ApiProperty({ type: RankInfoDto }) readonly rankInfo: RankInfoDto;

  constructor(data: {
    telegramUserId: string;
    fullName: string;
    avatarUrl: string | null;
    followedByMe: boolean;
    rankInfo: RankInfoDto;
  }) {
    this.telegramUserId = data.telegramUserId;
    this.fullName = data.fullName;
    this.avatarUrl = data.avatarUrl;
    this.followedByMe = data.followedByMe;
    this.rankInfo = data.rankInfo;
  }
}
