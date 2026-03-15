import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { PrismaService } from '@shared/prisma';
import { UserContextService } from '@shared/user-context';
import { computeRank } from '@shared/utils/compute-rank';
import { getPeriodRange } from '@shared/utils/period-range';

import { PointsBalanceResDto } from '../dto/response';
import { GetPointsBalanceQuery } from '../queries';

@QueryHandler(GetPointsBalanceQuery)
export class GetPointsBalanceHandler implements IQueryHandler<GetPointsBalanceQuery> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
  ) {}

  async execute(query: GetPointsBalanceQuery): Promise<PointsBalanceResDto> {
    const user = await this.userContextService.requireUserByTelegram(
      query.telegramUserId,
    );

    const weeklyRange = getPeriodRange('weekly');
    const monthlyRange = getPeriodRange('monthly');

    const [lifetime, weekly, monthly] = await Promise.all([
      this.prisma.pointsLedger.aggregate({
        _sum: { deltaPoints: true },
        where: { userId: user.id },
      }),
      this.prisma.pointsLedger.aggregate({
        _sum: { deltaPoints: true },
        where: {
          userId: user.id,
          createdAt: { gte: weeklyRange.start, lt: weeklyRange.end },
        },
      }),
      this.prisma.pointsLedger.aggregate({
        _sum: { deltaPoints: true },
        where: {
          userId: user.id,
          createdAt: { gte: monthlyRange.start, lt: monthlyRange.end },
        },
      }),
    ]);

    const lifetimePoints = lifetime._sum.deltaPoints ?? 0;

    return {
      lifetime: lifetimePoints,
      weekly: weekly._sum.deltaPoints ?? 0,
      monthly: monthly._sum.deltaPoints ?? 0,
      rank: computeRank(lifetimePoints),
    };
  }
}
