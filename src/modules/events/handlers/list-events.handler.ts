import { HttpStatus } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { HttpStatusDescriptions } from '@shared/constants';
import { GeneralApiResponseDto } from '@shared/dto';
import { PrismaService } from '@shared/prisma';
import { UserContextService } from '@shared/user-context';

import { EventListItemResDto } from '../dto/response';
import { EventStatusService } from '../event-status.service';
import { ListEventsQuery } from '../queries';

@QueryHandler(ListEventsQuery)
export class ListEventsHandler implements IQueryHandler<ListEventsQuery> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
    private readonly eventStatusService: EventStatusService,
  ) {}

  async execute(
    query: ListEventsQuery,
  ): Promise<GeneralApiResponseDto<EventListItemResDto[]>> {
    const { telegramUserId } = query;
    const user =
      await this.userContextService.requireUserByTelegram(telegramUserId);

    const events = await this.prisma.event.findMany({
      where: { isDeleted: false },
      orderBy: [{ startsAtUtc: 'asc' }],
      include: {
        participations: {
          where: { status: 'joined' },
          select: { userId: true },
        },
      },
      take: 50,
    });

    const items = events
      .map((event) => {
        const participantsCount = event.participations.length;
        const freeSpots =
          typeof event.maxParticipants === 'number'
            ? Math.max(0, event.maxParticipants - participantsCount)
            : null;
        const status = this.eventStatusService.calculate({
          status: event.status,
          startsAtUtc: event.startsAtUtc,
          endsAtUtc: event.endsAtUtc,
        });
        return new EventListItemResDto({
          id: event.id,
          title: event.title,
          status,
          startsAtUtc: event.startsAtUtc,
          participantsCount,
          freeSpots,
          coverSeed: event.coverSeed ?? null,
          joinedByMe: event.participations.some((p) => p.userId === user.id),
          isOrganizer: event.creatorUserId === user.id,
        });
      })
      // Показываем только активные события
      .filter((e) => e.status === 'upcoming' || e.status === 'ongoing');

    return new GeneralApiResponseDto(
      HttpStatus.OK,
      HttpStatusDescriptions[HttpStatus.OK],
      items,
    );
  }
}
