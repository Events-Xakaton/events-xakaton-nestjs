import { ApiProperty } from '@nestjs/swagger';

export class PointsBalanceResDto {
  @ApiProperty({ description: 'Суммарные очки за всё время' })
  declare lifetime: number;

  @ApiProperty({ description: 'Очки за текущую неделю' })
  declare weekly: number;

  @ApiProperty({ description: 'Очки за текущий месяц' })
  declare monthly: number;
}
