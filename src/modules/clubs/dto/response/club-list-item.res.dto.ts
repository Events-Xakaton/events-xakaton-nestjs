import { ApiProperty } from '@nestjs/swagger';

export class ClubListItemResDto {
  @ApiProperty() readonly id: string;
  @ApiProperty() readonly title: string;
  @ApiProperty() readonly description: string;
  @ApiProperty() readonly categoryCode: string;
  @ApiProperty() readonly membersCount: number;
  @ApiProperty({ nullable: true }) readonly coverSeed: string | null;
  @ApiProperty() readonly joinedByMe: boolean;
  @ApiProperty() readonly isCreator: boolean;

  constructor(data: {
    id: string;
    title: string;
    description: string;
    categoryCode: string;
    membersCount: number;
    coverSeed: string | null;
    joinedByMe: boolean;
    isCreator: boolean;
  }) {
    this.id = data.id;
    this.title = data.title;
    this.description = data.description;
    this.categoryCode = data.categoryCode;
    this.membersCount = data.membersCount;
    this.coverSeed = data.coverSeed;
    this.joinedByMe = data.joinedByMe;
    this.isCreator = data.isCreator;
  }
}
