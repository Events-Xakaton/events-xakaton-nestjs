import { ApiProperty } from '@nestjs/swagger';

import { AchievementResDto } from '@modules/achievements/dto/response';

export class ConfirmAttendanceResDto {
  @ApiProperty({ description: 'Статус операции' })
  declare status: string;

  @ApiProperty({
    type: [AchievementResDto],
    description: 'Достижения, разблокированные при подтверждении посещения',
  })
  declare unlockedAchievements: AchievementResDto[];
}
