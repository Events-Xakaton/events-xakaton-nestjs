import { HttpStatus } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { HttpStatusDescriptions } from '@shared/constants';
import { GeneralApiResponseDto } from '@shared/dto';
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
  ): Promise<GeneralApiResponseDto<EventParticipantResDto[]>> {
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
      where: { eventId, status: 'joined' },
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
      take: 300,
    });

    const participantIds = participants.map((p) => p.user.id);
    const following = participantIds.length
      ? await this.prisma.connection.findMany({
          where: {
            followerUserId: user.id,
            followedUserId: { in: participantIds },
          },
          select: { followedUserId: true },
        })
      : [];
    const followedSet = new Set(following.map((f) => f.followedUserId));

    const items = participants.map(
      (p) =>
        new EventParticipantResDto({
          telegramUserId: p.user.telegramUserId.toString(),
          fullName: p.user.fullName,
          avatarUrl: p.user.avatarUrl ?? null,
          followedByMe: followedSet.has(p.user.id),
        }),
    );

    return new GeneralApiResponseDto(
      HttpStatus.OK,
      HttpStatusDescriptions[HttpStatus.OK],
      items,
    );
  }
}
