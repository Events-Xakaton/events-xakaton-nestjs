import { ApiProperty } from '@nestjs/swagger';

import { AppRole } from '@shared/auth';

export class AdminUserResDto {
  @ApiProperty({ description: 'Telegram ID пользователя' })
  declare telegramUserId: string;

  @ApiProperty({ description: 'Полное имя пользователя' })
  declare fullName: string;

  @ApiProperty({ description: 'Верифицирован ли через Reddy' })
  declare isVerified: boolean;

  @ApiProperty({
    enum: AppRole,
    isArray: true,
    description: 'Роли пользователя',
  })
  declare roles: AppRole[];
}
