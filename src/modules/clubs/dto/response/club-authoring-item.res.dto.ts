import { ApiProperty } from '@nestjs/swagger';
import { ClubMemberRole } from '@prisma/client';

export class ClubAuthoringItemResDto {
  @ApiProperty() readonly id: string;
  @ApiProperty() readonly title: string;
  @ApiProperty({ enum: ClubMemberRole }) readonly role: ClubMemberRole;

  constructor(data: { id: string; title: string; role: ClubMemberRole }) {
    this.id = data.id;
    this.title = data.title;
    this.role = data.role;
  }
}
