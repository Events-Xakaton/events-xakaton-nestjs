import { ApiProperty } from '@nestjs/swagger';

import { RankInfoDto } from './rank-info.res.dto';

export class PointsBalanceResDto {
  @ApiProperty({ description: 'Суммарные очки за всё время' })
  declare lifetime: number;

  @ApiProperty({ description: 'Очки за текущую неделю' })
  declare weekly: number;

  @ApiProperty({ description: 'Очки за текущий месяц' })
  declare monthly: number;

  @ApiProperty({ type: RankInfoDto, description: 'Текущий ранг пользователя' })
  declare rank: RankInfoDto;
}
