import { HttpStatus } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { AnalyticsService } from '@analytics/analytics.service';
import { EventParticipationStatus, EventStatus } from '@shared/domain';
import { AppException } from '@shared/exceptions';
import { PrismaService } from '@shared/prisma';
import { UserContextService } from '@shared/user-context';
import { getWeekKey } from '@shared/utils/week-key';

import { RandomEventResDto } from '../dto/response';

import { EventStatusService } from '../event-status.service';
import { GetRandomEventQuery } from '../queries';

/** Размер окна ближайших событий для случайного выбора (Lucky Wheel policy) */
const K_NEAREST = 5;

@QueryHandler(GetRandomEventQuery)
export class GetRandomEventHandler
  implements IQueryHandler<GetRandomEventQuery>
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
    private readonly eventStatusService: EventStatusService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async execute(query: GetRandomEventQuery): Promise<RandomEventResDto> {
    const { telegramUserId } = query;
    const user =
      await this.userContextService.requireUserByTelegram(telegramUserId);

    // Граница недели — UTC-понедельник; 1 стандартный спин в неделю
    const weekKey = getWeekKey();

    const existingUsage = await this.prisma.luckyWheelUsage.findUnique({
      where: { userId_weekKey: { userId: user.id, weekKey } },
    });

    let usedFreeSpin = false;

    if (existingUsage) {
      // Стандартный спин уже использован — проверяем баланс фри-спинов
      const freeSpinBalance = await this.prisma.freeSpinBalance.findUnique({
        where: { userId: user.id },
      });
      if (!freeSpinBalance || freeSpinBalance.balance <= 0) {
        void this.analyticsService.track({
          eventName: 'event.random_open_denied',
          userId: user.id,
          context: { reason: 'DAILY_LIMIT_REACHED', weekKey },
        });
        throw new AppException({
          statusCode: HttpStatus.NOT_FOUND,
          message: 'DAILY_LIMIT_REACHED',
        });
      }
      // Тратим фри-спин
      await this.prisma.freeSpinBalance.update({
        where: { userId: user.id },
        data: { balance: { decrement: 1 } },
      });
      usedFreeSpin = true;
    }

    const events = await this.prisma.event.findMany({
      where: {
        isDeleted: false,
        status: { not: EventStatus.Cancelled },
        creatorUserId: { not: user.id },
        participations: {
          none: { userId: user.id, status: EventParticipationStatus.Joined },
        },
      },
      select: {
        id: true,
        status: true,
        startsAtUtc: true,
        endsAtUtc: true,
        maxParticipants: true,
        _count: {
          select: {
            participations: {
              where: { status: EventParticipationStatus.Joined },
            },
          },
        },
      },
    });

    const eligible = events.filter(
      (e) =>
        this.eventStatusService.calculate({
          status: e.status,
          startsAtUtc: e.startsAtUtc,
          endsAtUtc: e.endsAtUtc,
        }) === EventStatus.Upcoming &&
        (e.maxParticipants === null ||
          e._count.participations < e.maxParticipants),
    );

    if (eligible.length === 0) {
      void this.analyticsService.track({
        eventName: 'event.random_open_denied',
        userId: user.id,
        context: { reason: 'NO_ELIGIBLE_EVENTS', weekKey },
      });
      throw new AppException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'NO_ELIGIBLE_EVENTS',
      });
    }

    // Берём окно K ближайших по времени, выбираем случайный из него
    const sorted = [...eligible].sort(
      (a, b) => a.startsAtUtc.getTime() - b.startsAtUtc.getTime(),
    );
    const nearestWindow = sorted.slice(0, K_NEAREST);
    const pick = nearestWindow[Math.floor(Math.random() * nearestWindow.length)];

    // Фиксируем стандартный недельный спин (фри-спин LuckyWheelUsage не создаёт)
    if (!usedFreeSpin) {
      await this.prisma.luckyWheelUsage.create({
        data: { userId: user.id, weekKey },
      });
    }

    void this.analyticsService.track({
      eventName: 'event.random_open',
      userId: user.id,
      entityType: 'event',
      entityId: pick.id,
      context: { candidatesCount: eligible.length, windowSize: nearestWindow.length, usedFreeSpin, weekKey },
    });

    const result = new RandomEventResDto();
    result.id = pick.id;
    result.usedFreeSpin = usedFreeSpin;
    return result;
  }
}
