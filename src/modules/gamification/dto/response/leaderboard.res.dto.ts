import { ApiProperty } from '@nestjs/swagger';

import { RankInfoDto } from './rank-info.res.dto';

export class LeaderboardEntryResDto {
  @ApiProperty({
    nullable: true,
    description: 'Позиция в рейтинге. null — если нет очков за период',
  })
  declare position: number | null;

  @ApiProperty({ description: 'UUID пользователя' })
  declare userId: string;

  @ApiProperty({ description: 'Полное имя пользователя' })
  declare fullName: string;

  @ApiProperty({
    nullable: true,
    description: 'URL аватара (иконка достижения, если применена)',
  })
  declare avatarUrl: string | null;

  @ApiProperty({ description: 'Количество очков за период' })
  declare points: number;

  @ApiProperty({
    type: RankInfoDto,
    description: 'Ранг пользователя (по lifetime очкам)',
  })
  declare rankInfo: RankInfoDto;
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
    description: 'Позиция текущего пользователя (null если не авторизован)',
  })
  declare currentUser: LeaderboardEntryResDto | null;
}
