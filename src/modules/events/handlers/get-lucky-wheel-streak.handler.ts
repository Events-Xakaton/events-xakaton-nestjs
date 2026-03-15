import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { PrismaService } from '@shared/prisma';
import { UserContextService } from '@shared/user-context';
import { getWeekKey } from '@shared/utils/week-key';

import { LuckyWheelStreakResDto } from '../dto/response';
import { GetLuckyWheelStreakQuery } from '../queries';

/** Количество дней подряд для получения одного фри-спина */
const STREAK_THRESHOLD = 3;

@QueryHandler(GetLuckyWheelStreakQuery)
export class GetLuckyWheelStreakHandler
  implements IQueryHandler<GetLuckyWheelStreakQuery>
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
  ) {}

  async execute(query: GetLuckyWheelStreakQuery): Promise<LuckyWheelStreakResDto> {
    const user = await this.userContextService.requireUserByTelegram(
      query.telegramUserId,
    );

    const weekKey = getWeekKey();

    const [streak, balance, weeklyUsage] = await Promise.all([
      this.prisma.loginStreak.findUnique({ where: { userId: user.id } }),
      this.prisma.freeSpinBalance.findUnique({ where: { userId: user.id } }),
      this.prisma.luckyWheelUsage.findUnique({
        where: { userId_weekKey: { userId: user.id, weekKey } },
      }),
    ]);

    const currentStreak = streak?.currentStreak ?? 0;
    const streakMod = currentStreak % STREAK_THRESHOLD;
    const daysUntilFreeSpin =
      streakMod === 0 ? STREAK_THRESHOLD : STREAK_THRESHOLD - streakMod;

    // Понедельник следующей недели — дата разблокировки стандартного спина
    const nextWeekDate = new Date(weekKey);
    nextWeekDate.setUTCDate(nextWeekDate.getUTCDate() + 7);
    const nextWeekKey = nextWeekDate.toISOString().slice(0, 10);

    const result = new LuckyWheelStreakResDto();
    result.currentStreak = currentStreak;
    result.daysUntilFreeSpin = daysUntilFreeSpin;
    result.freeSpinBalance = balance?.balance ?? 0;
    result.hasUsedWeeklySpin = weeklyUsage !== null;
    result.nextWeekKey = nextWeekKey;
    return result;
  }
}
