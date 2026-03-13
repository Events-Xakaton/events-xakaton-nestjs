import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

import { AppRole } from '@shared/auth';

export class AssignRoleDto {
  @ApiProperty({
    description: 'Роль',
    enum: AppRole,
  })
  @IsEnum(AppRole)
  role!: AppRole;
}
