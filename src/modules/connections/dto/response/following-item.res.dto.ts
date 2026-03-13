import { ApiProperty } from '@nestjs/swagger';

export class FollowingItemResDto {
  @ApiProperty() readonly telegramUserId: string;
  @ApiProperty() readonly fullName: string;
  @ApiProperty() readonly followedAt: Date;

  constructor(data: {
    telegramUserId: string;
    fullName: string;
    followedAt: Date;
  }) {
    this.telegramUserId = data.telegramUserId;
    this.fullName = data.fullName;
    this.followedAt = data.followedAt;
  }
}
