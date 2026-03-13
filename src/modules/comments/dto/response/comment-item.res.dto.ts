import { ApiProperty } from '@nestjs/swagger';

export class CommentItemResDto {
  @ApiProperty() readonly id: string;
  @ApiProperty() readonly authorTelegramUserId: string;
  @ApiProperty() readonly authorName: string;
  @ApiProperty() readonly text: string;
  @ApiProperty() readonly createdAt: Date;
  @ApiProperty() readonly updatedAt: Date;

  constructor(data: {
    id: string;
    authorTelegramUserId: string;
    authorName: string;
    text: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = data.id;
    this.authorTelegramUserId = data.authorTelegramUserId;
    this.authorName = data.authorName;
    this.text = data.text;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }
}
