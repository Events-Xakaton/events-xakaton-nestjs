import { ApiProperty } from '@nestjs/swagger';

import { AchievementResDto } from '@modules/achievements/dto/response';

export class CreateEventResDto {
  @ApiProperty({ description: 'UUID созданного события' })
  declare id: string;

  @ApiProperty({
    type: [AchievementResDto],
    description: 'Достижения, разблокированные при создании события',
  })
  declare unlockedAchievements: AchievementResDto[];
}
