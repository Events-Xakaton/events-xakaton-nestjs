import { HttpStatus } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { HttpStatusDescriptions } from '../../../shared/constants';
import { GeneralApiResponseDto } from '../../../shared/dto';
import { PrismaService } from '../../../shared/prisma';
import { UserContextService } from '../../../shared/user-context';
import { getPeriodRange } from '../../../shared/utils/period-range';
import { GetLeaderboardQuery } from '../queries';

type LeaderboardEntry = {
  rank: number;
  userId: string;
  fullName: string;
  points: number;
};

@QueryHandler(GetLeaderboardQuery)
export class GetLeaderboardHandler implements IQueryHandler<GetLeaderboardQuery> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
  ) {}

  async execute(query: GetLeaderboardQuery): Promise<
    GeneralApiResponseDto<{
      period: 'weekly' | 'monthly';
      top: LeaderboardEntry[];
      currentUser: LeaderboardEntry | null;
    }>
  > {
    const { period, telegramUserId } = query;
    const user = telegramUserId
      ? await this.userContextService.requireUserByTelegram(telegramUserId)
      : null;

    const range = getPeriodRange(period);
    const grouped = await this.prisma.pointsLedger.groupBy({
      by: ['userId'],
      _sum: { deltaPoints: true },
      where: { createdAt: { gte: range.start, lt: range.end } },
      orderBy: { _sum: { deltaPoints: 'desc' } },
    });

    const aggregated = grouped.map((row) => ({
      userId: row.userId,
      points: row._sum.deltaPoints ?? 0,
    }));

    const userIds = aggregated.map((r) => r.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fullName: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u.fullName]));

    const sorted = aggregated
      .map((r) => ({
        userId: r.userId,
        points: r.points,
        fullName: userMap.get(r.userId) ?? 'Unknown',
      }))
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        const byName = a.fullName.localeCompare(b.fullName, 'ru');
        if (byName !== 0) return byName;
        return a.userId.localeCompare(b.userId);
      });

    const ranked: LeaderboardEntry[] = sorted.map((row, index) => ({
      rank: index + 1,
      userId: row.userId,
      fullName: row.fullName,
      points: row.points,
    }));

    const top = ranked.slice(0, 10);

    let currentUser: LeaderboardEntry | null = null;
    if (user) {
      const mine = ranked.find((r) => r.userId === user.id);
      if (mine) {
        currentUser = mine;
      } else {
        const userRecord = await this.prisma.user.findUnique({
          where: { id: user.id },
          select: { fullName: true },
        });
        currentUser = {
          rank: 0,
          userId: user.id,
          fullName: userRecord?.fullName ?? 'Unknown',
          points: 0,
        };
      }
    }

    return new GeneralApiResponseDto(
      HttpStatus.OK,
      HttpStatusDescriptions[HttpStatus.OK],
      {
        period,
        top,
        currentUser,
      },
    );
  }
}
