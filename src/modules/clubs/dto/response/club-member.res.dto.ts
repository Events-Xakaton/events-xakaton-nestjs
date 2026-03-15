import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClubMemberRole } from '@prisma/client';

import { RankInfoDto } from '@modules/gamification/dto/response';

export class ClubMemberResDto {
  @ApiProperty() readonly telegramUserId: string;
  @ApiProperty() readonly fullName: string;
  @ApiProperty({ nullable: true }) readonly avatarUrl: string | null;
  @ApiProperty() readonly followedByMe: boolean;
  @ApiPropertyOptional({ enum: ClubMemberRole }) readonly role?: ClubMemberRole;
  @ApiProperty({ type: RankInfoDto }) readonly rankInfo: RankInfoDto;

  constructor(data: {
    telegramUserId: string;
    fullName: string;
    avatarUrl: string | null;
    followedByMe: boolean;
    role?: ClubMemberRole;
    rankInfo: RankInfoDto;
  }) {
    this.telegramUserId = data.telegramUserId;
    this.fullName = data.fullName;
    this.avatarUrl = data.avatarUrl;
    this.followedByMe = data.followedByMe;
    this.role = data.role;
    this.rankInfo = data.rankInfo;
  }
}
