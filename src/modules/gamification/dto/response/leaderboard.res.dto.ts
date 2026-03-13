import { ApiProperty } from '@nestjs/swagger';

export class LeaderboardEntryResDto {
  @ApiProperty({ description: 'Позиция в рейтинге' })
  declare rank: number;

  @ApiProperty({ description: 'UUID пользователя' })
  declare userId: string;

  @ApiProperty({ description: 'Полное имя пользователя' })
  declare fullName: string;

  @ApiProperty({ description: 'Количество очков за период' })
  declare points: number;
}

export class LeaderboardResDto {
  @ApiProperty({ enum: ['weekly', 'monthly'], description: 'Период рейтинга' })
  declare period: 'weekly' | 'monthly';

  @ApiProperty({
    type: [LeaderboardEntryResDto],
    description: 'Топ участников',
  })
  declare top: LeaderboardEntryResDto[];

  @ApiProperty({
    type: LeaderboardEntryResDto,
    nullable: true,
    description: 'Позиция текущего пользователя (null если не в топе)',
  })
  declare currentUser: LeaderboardEntryResDto | null;
}
