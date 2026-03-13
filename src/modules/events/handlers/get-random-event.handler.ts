import { HttpStatus } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { AnalyticsService } from '../../../analytics/analytics.service';
import { HttpStatusDescriptions } from '../../../shared/constants';
import { GeneralApiResponseDto } from '../../../shared/dto';
import { PrismaService } from '../../../shared/prisma';
import { UserContextService } from '../../../shared/user-context';
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
  ): Promise<GeneralApiResponseDto<{ id: string }>> {
    const { telegramUserId } = query;
    const user =
      await this.userContextService.requireUserByTelegram(telegramUserId);

    const events = await this.prisma.event.findMany({
      where: {
        isDeleted: false,
        status: { not: 'cancelled' },
        creatorUserId: { not: user.id },
        participations: { none: { userId: user.id, status: 'joined' } },
      },
      select: { id: true, status: true, startsAtUtc: true, endsAtUtc: true },
    });

    const eligible = events.filter(
      (e) =>
        this.eventStatusService.calculate({
          status: e.status,
          startsAtUtc: e.startsAtUtc,
          endsAtUtc: e.endsAtUtc,
        }) === 'upcoming',
    );

    if (eligible.length === 0) {
      return new GeneralApiResponseDto(
        HttpStatus.NOT_FOUND,
        HttpStatusDescriptions[HttpStatus.NOT_FOUND],
        null as never,
        { message: 'Нет подходящих случайных событий' },
      );
    }

    const pick = eligible[Math.floor(Math.random() * eligible.length)];
    void this.analyticsService.track({
      eventName: 'event.random_open',
      entityType: 'event',
      entityId: pick.id,
    });

    return new GeneralApiResponseDto(
      HttpStatus.OK,
      HttpStatusDescriptions[HttpStatus.OK],
      { id: pick.id },
    );
  }
}
