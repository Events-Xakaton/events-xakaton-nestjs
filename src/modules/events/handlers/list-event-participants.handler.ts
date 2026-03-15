import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { EnvVariableName } from '@shared/config';
import { PAGINATION } from '@shared/constants';
import { EventParticipationStatus } from '@shared/domain';
import { AppException } from '@shared/exceptions';
import { resolveAvatarUrl } from '@shared/helpers/resolve-avatar.helper';
import { PrismaService } from '@shared/prisma';
import { UserContextService } from '@shared/user-context';
import { computeRank } from '@shared/utils/compute-rank';

import { EventParticipantResDto } from '../dto/response';
import { ListEventParticipantsQuery } from '../queries';

@QueryHandler(ListEventParticipantsQuery)
export class ListEventParticipantsHandler implements IQueryHandler<ListEventParticipantsQuery> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
    private readonly config: ConfigService,
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
            activeAchievement: { select: { iconPath: true } },
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
      take: PAGINATION.EVENT_PARTICIPANTS_LIMIT,
    });

    const participantIds = participants.map((p) => p.user.id);

    const [followedSet, lifetimeRows, confirmations] = await Promise.all([
      this.userContextService.getFollowedSet(user.id, participantIds),
      this.prisma.pointsLedger.groupBy({
        by: ['userId'],
        _sum: { deltaPoints: true },
        where: { userId: { in: participantIds } },
      }),
      this.prisma.attendanceConfirmation.findMany({
        where: { eventId },
        select: { userId: true, rating: true },
      }),
    ]);

    const lifetimeMap = new Map(
      lifetimeRows.map((r) => [r.userId, r._sum.deltaPoints ?? 0]),
    );

    // userId → rating (null если подтверждён без оценки)
    const confirmationMap = new Map<string, number | null>(
      confirmations.map((c) => [c.userId, c.rating ?? null]),
    );

    const baseUrl =
      this.config.get<string>(EnvVariableName.APP_BASE_URL) ??
      'http://localhost:4000';

    const items = participants.map(
      (p) =>
        new EventParticipantResDto({
          telegramUserId: p.user.telegramUserId.toString(),
          fullName: p.user.fullName,
          avatarUrl: resolveAvatarUrl(p.user, baseUrl),
          followedByMe: followedSet.has(p.user.id),
          rankInfo: computeRank(lifetimeMap.get(p.user.id) ?? 0),
          rating: confirmationMap.has(p.user.id)
            ? (confirmationMap.get(p.user.id) ?? null)
            : null,
          attendanceConfirmed: confirmationMap.has(p.user.id),
        }),
    );

    return items;
  }
}
