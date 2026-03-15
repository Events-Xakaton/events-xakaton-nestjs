import { HttpStatus } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { PAGINATION } from '@shared/constants';
import { EventParticipationStatus, EventStatus } from '@shared/domain';
import { AppException } from '@shared/exceptions';
import { PrismaService } from '@shared/prisma';
import { UserContextService } from '@shared/user-context';
import { computeEventStatus } from '@shared/utils/event-status.utils';

import { ClubEventItemResDto, ClubEventsPageResDto } from '../dto/response';
import { ListClubEventsQuery } from '../queries';

@QueryHandler(ListClubEventsQuery)
export class ListClubEventsHandler implements IQueryHandler<ListClubEventsQuery> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
  ) {}

  async execute(query: ListClubEventsQuery): Promise<ClubEventsPageResDto> {
    const { telegramUserId, clubId } = query;
    const bucket = query.bucket ?? EventStatus.Upcoming;
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(
      Math.max(query.limit ?? PAGINATION.CLUB_EVENTS_DEFAULT_LIMIT, 1),
      PAGINATION.CLUB_EVENTS_MAX_LIMIT,
    );

    await this.userContextService.requireUserByTelegram(telegramUserId);

    const club = await this.prisma.club.findFirst({
      where: { id: clubId, isDeleted: false },
      select: { id: true },
    });
    if (!club) {
      throw new AppException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Клуб не найден',
      });
    }

    const now = new Date();
    const baseWhere = {
      clubId,
      isDeleted: false,
      status: { not: EventStatus.Cancelled },
    };

    const where =
      bucket === EventStatus.Upcoming
        ? { ...baseWhere, startsAtUtc: { gt: now } }
        : bucket === EventStatus.Ongoing
          ? { ...baseWhere, startsAtUtc: { lte: now }, endsAtUtc: { gt: now } }
          : { ...baseWhere, endsAtUtc: { lte: now } };

    // Прошедшие события — от нового к старому; предстоящие/текущие — от ближайшего
    const orderBy =
      bucket === EventStatus.Past
        ? [{ startsAtUtc: 'desc' as const }, { id: 'desc' as const }]
        : [{ startsAtUtc: 'asc' as const }, { id: 'asc' as const }];

    const skip = (page - 1) * limit;

    const [total, events] = await Promise.all([
      this.prisma.event.count({ where }),
      this.prisma.event.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          participations: {
            where: { status: EventParticipationStatus.Joined },
            select: { userId: true },
          },
        },
      }),
    ]);

    const items = events.map((event) => {
      const participantsCount = event.participations.length;
      const freeSpots =
        typeof event.maxParticipants === 'number'
          ? Math.max(0, event.maxParticipants - participantsCount)
          : null;

      return new ClubEventItemResDto({
        id: event.id,
        title: event.title,
        status: computeEventStatus(
          event.status,
          event.startsAtUtc,
          event.endsAtUtc,
          now,
        ),
        startsAtUtc: event.startsAtUtc,
        endsAtUtc: event.endsAtUtc,
        participantsCount,
        freeSpots,
        minLevel: event.minLevel ?? null,
      });
    });

    return new ClubEventsPageResDto({
      bucket,
      page,
      limit,
      hasMore: skip + events.length < total,
      total,
      items,
    });
  }
}
