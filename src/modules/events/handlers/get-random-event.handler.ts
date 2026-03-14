import { HttpStatus } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { AnalyticsService } from '@analytics/analytics.service';
import { EventParticipationStatus, EventStatus } from '@shared/domain';
import { AppException } from '@shared/exceptions';
import { PrismaService } from '@shared/prisma';
import { IdResDto } from '@shared/types';
import { UserContextService } from '@shared/user-context';

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

  async execute(query: GetRandomEventQuery): Promise<IdResDto> {
    const { telegramUserId } = query;
    const user =
      await this.userContextService.requireUserByTelegram(telegramUserId);

    // Граница дня — 00:00 UTC, не скользящие 24 часа
    const dayKey = new Date().toISOString().slice(0, 10);

    const existingUsage = await this.prisma.luckyWheelUsage.findUnique({
      where: { userId_dayKey: { userId: user.id, dayKey } },
    });

    if (existingUsage) {
      void this.analyticsService.track({
        eventName: 'event.random_open_denied',
        userId: user.id,
        context: { reason: 'DAILY_LIMIT_REACHED', dayKey },
      });
      throw new AppException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'DAILY_LIMIT_REACHED',
      });
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
        context: { reason: 'NO_ELIGIBLE_EVENTS', dayKey },
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

    // Фиксируем использование механики на текущий UTC-день
    await this.prisma.luckyWheelUsage.create({
      data: { userId: user.id, dayKey },
    });

    void this.analyticsService.track({
      eventName: 'event.random_open',
      userId: user.id,
      entityType: 'event',
      entityId: pick.id,
      context: { candidatesCount: eligible.length, windowSize: nearestWindow.length },
    });

    return { id: pick.id };
  }
}
