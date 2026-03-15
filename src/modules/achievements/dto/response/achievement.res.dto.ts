import { ApiProperty } from '@nestjs/swagger';

export class AchievementResDto {
  @ApiProperty({ description: 'UUID достижения' })
  declare id: string;

  @ApiProperty({ description: 'Программный код достижения' })
  declare code: string;

  @ApiProperty({ description: 'Название достижения' })
  declare name: string;

  @ApiProperty({ description: 'Описание условия получения' })
  declare description: string;

  @ApiProperty({ description: 'Абсолютный URL иконки достижения' })
  declare iconUrl: string;

  @ApiProperty({ description: 'Дата получения (ISO 8601)' })
  declare earnedAt: string;

  @ApiProperty({
    description: 'true — иконка применена как аватар пользователя',
  })
  declare isActive: boolean;
}
