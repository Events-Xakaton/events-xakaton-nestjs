import { HttpStatus } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { PAGINATION } from '@shared/constants';
import { EventParticipationStatus } from '@shared/domain';
import { AppException } from '@shared/exceptions';
import { PrismaService } from '@shared/prisma';
import { UserContextService } from '@shared/user-context';

import { EventParticipantResDto } from '../dto/response';
import { ListEventParticipantsQuery } from '../queries';

@QueryHandler(ListEventParticipantsQuery)
export class ListEventParticipantsHandler implements IQueryHandler<ListEventParticipantsQuery> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
  ) {}

  async execute(
    query: ListEventParticipantsQuery,
  ): Promise<EventParticipantResDto[]> {
    const { telegramUserId, eventId } = query;
    const user =
      await this.userContextService.requireUserByTelegram(telegramUserId);

    const event = await this.prisma.event.findFirst({
      where: { id: eventId, isDeleted: false },
      select: { id: true },
    });
    if (!event) {
      throw new AppException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Событие не найдено',
      });
    }

    const participants = await this.prisma.eventParticipation.findMany({
      where: { eventId, status: EventParticipationStatus.Joined },
      include: {
        user: {
          select: {
            id: true,
            telegramUserId: true,
            fullName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
      take: PAGINATION.EVENT_PARTICIPANTS_LIMIT,
    });

    const participantIds = participants.map((p) => p.user.id);
    const followedSet = await this.userContextService.getFollowedSet(
      user.id,
      participantIds,
    );

    const items = participants.map(
      (p) =>
        new EventParticipantResDto({
          telegramUserId: p.user.telegramUserId.toString(),
          fullName: p.user.fullName,
          avatarUrl: p.user.avatarUrl ?? null,
          followedByMe: followedSet.has(p.user.id),
        }),
    );

    return items;
  }
}
