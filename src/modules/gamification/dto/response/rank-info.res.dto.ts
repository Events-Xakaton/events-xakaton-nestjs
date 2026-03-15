import { ApiProperty } from '@nestjs/swagger';

export class RankInfoDto {
  @ApiProperty({ description: 'Уровень (1–10)' })
  declare level: number;

  @ApiProperty({ description: 'Название ранга' })
  declare title: string;

  @ApiProperty({ description: 'Метка для отображения: «Ур. N · Название»' })
  declare label: string;

  @ApiProperty({
    description: 'Очков до следующего уровня (null на максимальном уровне)',
    nullable: true,
  })
  declare pointsToNextLevel: number | null;
}
