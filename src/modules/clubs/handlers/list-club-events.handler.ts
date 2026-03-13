import { HttpStatus } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { HttpStatusDescriptions } from '../../../shared/constants';
import { GeneralApiResponseDto } from '../../../shared/dto';
import { PrismaService } from '../../../shared/prisma';
import { UserContextService } from '../../../shared/user-context';
import { computeEventStatus } from '../../../shared/utils/event-status.utils';
import { ClubEventItemResDto, ClubEventsPageResDto } from '../dto/response';
import { ListClubEventsQuery } from '../queries';

@QueryHandler(ListClubEventsQuery)
export class ListClubEventsHandler implements IQueryHandler<ListClubEventsQuery> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
  ) {}

  async execute(
    query: ListClubEventsQuery,
  ): Promise<GeneralApiResponseDto<ClubEventsPageResDto>> {
    const { telegramUserId, clubId } = query;
    const bucket = query.bucket ?? 'upcoming';
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 10, 1), 20);

    await this.userContextService.requireUserByTelegram(telegramUserId);

    const club = await this.prisma.club.findFirst({
      where: { id: clubId, isDeleted: false },
      select: { id: true },
    });
    if (!club) {
      return new GeneralApiResponseDto(
        HttpStatus.NOT_FOUND,
        HttpStatusDescriptions[HttpStatus.NOT_FOUND],
        null as never,
        { message: 'Клуб не найден' },
      );
    }

    const now = new Date();
    const baseWhere = {
      clubId,
      isDeleted: false,
      status: { not: 'cancelled' as const },
    };

    const where =
      bucket === 'upcoming'
        ? { ...baseWhere, startsAtUtc: { gt: now } }
        : bucket === 'ongoing'
          ? { ...baseWhere, startsAtUtc: { lte: now }, endsAtUtc: { gt: now } }
          : { ...baseWhere, endsAtUtc: { lte: now } };

    // Прошедшие события — от нового к старому; предстоящие/текущие — от ближайшего
    const orderBy =
      bucket === 'past'
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
            where: { status: 'joined' },
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
      });
    });

    return new GeneralApiResponseDto(
      HttpStatus.OK,
      HttpStatusDescriptions[HttpStatus.OK],
      new ClubEventsPageResDto({
        bucket,
        page,
        limit,
        hasMore: skip + events.length < total,
        total,
        items,
      }),
    );
  }
}
