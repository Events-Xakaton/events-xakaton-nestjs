import { ApiProperty } from '@nestjs/swagger';

export class EventParticipantResDto {
  @ApiProperty() readonly telegramUserId: string;
  @ApiProperty() readonly fullName: string;
  @ApiProperty({ nullable: true }) readonly avatarUrl: string | null;
  @ApiProperty() readonly followedByMe: boolean;

  constructor(data: {
    telegramUserId: string;
    fullName: string;
    avatarUrl: string | null;
    followedByMe: boolean;
  }) {
    this.telegramUserId = data.telegramUserId;
    this.fullName = data.fullName;
    this.avatarUrl = data.avatarUrl;
    this.followedByMe = data.followedByMe;
  }
}
