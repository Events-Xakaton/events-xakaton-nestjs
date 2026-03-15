import { ConfigService } from '@nestjs/config';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { EnvVariableName } from '@shared/config';
import { PAGINATION } from '@shared/constants';
import { resolveAvatarUrl } from '@shared/helpers/resolve-avatar.helper';
import { PrismaService } from '@shared/prisma';
import { UserContextService } from '@shared/user-context';
import { computeRank } from '@shared/utils/compute-rank';
import { getPeriodRange } from '@shared/utils/period-range';

import { LeaderboardEntryResDto, LeaderboardResDto } from '../dto/response';
import { GetLeaderboardQuery } from '../queries';

@QueryHandler(GetLeaderboardQuery)
export class GetLeaderboardHandler implements IQueryHandler<GetLeaderboardQuery> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
    private readonly config: ConfigService,
  ) {}

  async execute(query: GetLeaderboardQuery): Promise<LeaderboardResDto> {
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
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
        activeAchievement: { select: { iconPath: true } },
      },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const baseUrl =
      this.config.get<string>(EnvVariableName.APP_BASE_URL) ??
      'http://localhost:4000';

    const sorted = aggregated
      .map((r) => {
        const u = userMap.get(r.userId);
        return {
          userId: r.userId,
          points: r.points,
          fullName: u?.fullName ?? 'Unknown',
          avatarUrl: u ? resolveAvatarUrl(u, baseUrl) : null,
        };
      })
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        const byName = a.fullName.localeCompare(b.fullName, 'ru');
        if (byName !== 0) return byName;
        return a.userId.localeCompare(b.userId);
      });

    // Временные записи с position для определения currentUser
    const ranked = sorted.map((row, index) => ({
      position: index + 1,
      userId: row.userId,
      fullName: row.fullName,
      avatarUrl: row.avatarUrl,
      points: row.points,
    }));

    const top = ranked.slice(0, PAGINATION.LEADERBOARD_TOP_SIZE);

    type RankedEntry = (typeof ranked)[number];
    type CurrentUserBase = Omit<RankedEntry, 'position'> & { position: number | null };
    let currentUserBase: CurrentUserBase | null = null;
    if (user) {
      const mine = ranked.find((r) => r.userId === user.id);
      if (mine) {
        currentUserBase = mine;
      } else {
        const userRecord = await this.prisma.user.findUnique({
          where: { id: user.id },
          select: {
            fullName: true,
            avatarUrl: true,
            activeAchievement: { select: { iconPath: true } },
          },
        });
        currentUserBase = {
          position: null,
          userId: user.id,
          fullName: userRecord?.fullName ?? 'Unknown',
          avatarUrl: userRecord ? resolveAvatarUrl(userRecord, baseUrl) : null,
          points: 0,
        };
      }
    }

    // Батч-запрос lifetime очков для top + currentUser — нужны для ранга
    const relevantIds = [
      ...new Set([
        ...top.map((r) => r.userId),
        ...(currentUserBase ? [currentUserBase.userId] : []),
      ]),
    ];
    const lifetimeRows =
      relevantIds.length > 0
        ? await this.prisma.pointsLedger.groupBy({
            by: ['userId'],
            _sum: { deltaPoints: true },
            where: { userId: { in: relevantIds } },
          })
        : [];
    const lifetimeMap = new Map(
      lifetimeRows.map((r) => [r.userId, r._sum.deltaPoints ?? 0]),
    );

    const topWithRank: LeaderboardEntryResDto[] = top.map((entry) => ({
      ...entry,
      rankInfo: computeRank(lifetimeMap.get(entry.userId) ?? 0),
    }));

    const currentUser: LeaderboardResDto['currentUser'] = currentUserBase
      ? {
          ...currentUserBase,
          rankInfo: computeRank(lifetimeMap.get(currentUserBase.userId) ?? 0),
        }
      : null;

    return {
      period,
      top: topWithRank,
      currentUser,
    };
  }
}
