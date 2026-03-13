import { ApiProperty } from '@nestjs/swagger';

export class PointsRuleResDto {
  @ApiProperty({ description: 'Код правила начисления' })
  declare rule: string;

  @ApiProperty({ description: 'Количество очков' })
  declare points: number;
}
