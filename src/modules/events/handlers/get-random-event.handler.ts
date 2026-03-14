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

@QueryHandler(GetRandomEventQuery)
export class GetRandomEventHandler implements IQueryHandler<GetRandomEventQuery> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
    private readonly eventStatusService: EventStatusService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async execute(
    query: GetRandomEventQuery,
  ): Promise<IdResDto> {
    const { telegramUserId } = query;
    const user =
      await this.userContextService.requireUserByTelegram(telegramUserId);

    const events = await this.prisma.event.findMany({
      where: {
        isDeleted: false,
        status: { not: EventStatus.Cancelled },
        creatorUserId: { not: user.id },
        participations: {
          none: { userId: user.id, status: EventParticipationStatus.Joined },
        },
      },
      select: { id: true, status: true, startsAtUtc: true, endsAtUtc: true },
    });

    const eligible = events.filter(
      (e) =>
        this.eventStatusService.calculate({
          status: e.status,
          startsAtUtc: e.startsAtUtc,
          endsAtUtc: e.endsAtUtc,
        }) === EventStatus.Upcoming,
    );

    if (eligible.length === 0) {
      throw new AppException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Нет подходящих случайных событий',
      });
    }

    const pick = eligible[Math.floor(Math.random() * eligible.length)];
    void this.analyticsService.track({
      eventName: 'event.random_open',
      entityType: 'event',
      entityId: pick.id,
    });

    return { id: pick.id };
  }
}
