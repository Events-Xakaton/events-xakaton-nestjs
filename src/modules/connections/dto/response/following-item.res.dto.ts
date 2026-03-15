import { ApiProperty } from '@nestjs/swagger';

import { RankInfoDto } from '@modules/gamification/dto/response';

export class FollowingItemResDto {
  @ApiProperty() readonly telegramUserId: string;
  @ApiProperty() readonly fullName: string;
  @ApiProperty() readonly followedAt: Date;
  @ApiProperty({ type: RankInfoDto }) readonly rankInfo: RankInfoDto;

  constructor(data: {
    telegramUserId: string;
    fullName: string;
    followedAt: Date;
    rankInfo: RankInfoDto;
  }) {
    this.telegramUserId = data.telegramUserId;
    this.fullName = data.fullName;
    this.followedAt = data.followedAt;
    this.rankInfo = data.rankInfo;
  }
}
