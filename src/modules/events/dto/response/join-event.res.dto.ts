import { ApiProperty } from '@nestjs/swagger';

import { AchievementResDto } from '@modules/achievements/dto/response';

export class JoinEventResDto {
  @ApiProperty({ description: 'Статус операции' })
  declare status: string;

  @ApiProperty({
    type: [AchievementResDto],
    description: 'Достижения, разблокированные при вступлении в событие',
  })
  declare unlockedAchievements: AchievementResDto[];
}
