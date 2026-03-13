import { ApiProperty } from '@nestjs/swagger';

export class PointsHistoryItemResDto {
  @ApiProperty({ description: 'ID записи' })
  declare id: string;

  @ApiProperty({ description: 'Код правила начисления' })
  declare ruleCode: string;

  @ApiProperty({
    description: 'Изменение очков (положительное или отрицательное)',
  })
  declare deltaPoints: number;

  @ApiProperty({ description: 'Дата начисления' })
  declare createdAt: Date;
}
