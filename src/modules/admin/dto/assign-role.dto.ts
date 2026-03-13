import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class AssignRoleDto {
  @ApiProperty({
    description: 'Роль',
    enum: ['Member', 'ClubAdmin', 'PlatformAdmin'],
  })
  @IsIn(['Member', 'ClubAdmin', 'PlatformAdmin'])
  role!: 'Member' | 'ClubAdmin' | 'PlatformAdmin';
}
