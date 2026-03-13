import { ApiProperty } from '@nestjs/swagger';

export class ClubDetailResDto {
  @ApiProperty() readonly id: string;
  @ApiProperty() readonly title: string;
  @ApiProperty() readonly description: string;
  @ApiProperty() readonly categoryCode: string;
  @ApiProperty({ nullable: true }) readonly coverUrl: string | null;
  @ApiProperty() readonly creatorTelegramUserId: string;
  @ApiProperty() readonly creatorName: string;
  @ApiProperty() readonly membersCount: number;
  @ApiProperty() readonly joinedByMe: boolean;
  @ApiProperty() readonly canManage: boolean;
  @ApiProperty({ type: [String] }) readonly tags: string[];
  @ApiProperty({ nullable: true }) readonly coverSeed: string | null;

  constructor(data: {
    id: string;
    title: string;
    description: string;
    categoryCode: string;
    coverUrl: string | null;
    creatorTelegramUserId: string;
    creatorName: string;
    membersCount: number;
    joinedByMe: boolean;
    canManage: boolean;
    tags: string[];
    coverSeed: string | null;
  }) {
    this.id = data.id;
    this.title = data.title;
    this.description = data.description;
    this.categoryCode = data.categoryCode;
    this.coverUrl = data.coverUrl;
    this.creatorTelegramUserId = data.creatorTelegramUserId;
    this.creatorName = data.creatorName;
    this.membersCount = data.membersCount;
    this.joinedByMe = data.joinedByMe;
    this.canManage = data.canManage;
    this.tags = data.tags;
    this.coverSeed = data.coverSeed;
  }
}
