import { HttpStatus } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { AppRole } from '@shared/auth';
import { HttpStatusDescriptions } from '@shared/constants';
import { GeneralApiResponseDto } from '@shared/dto';
import { PrismaService } from '@shared/prisma';
import { UserContextService } from '@shared/user-context';

import { EventDetailResDto } from '../dto/response';
import { EventStatusService } from '../event-status.service';
import { GetEventQuery } from '../queries';

@QueryHandler(GetEventQuery)
export class GetEventHandler implements IQueryHandler<GetEventQuery> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
    private readonly eventStatusService: EventStatusService,
  ) {}

  async execute(
    query: GetEventQuery,
  ): Promise<GeneralApiResponseDto<EventDetailResDto>> {
    const { telegramUserId, eventId } = query;
    const user =
      await this.userContextService.requireUserByTelegram(telegramUserId);

    const event = await this.prisma.event.findFirst({
      where: { id: eventId, isDeleted: false },
      include: {
        creator: { select: { id: true, telegramUserId: true, fullName: true } },
        club: { select: { id: true, title: true } },
        tags: { select: { tag: true } },
        participations: {
          where: { status: 'joined' },
          select: { userId: true },
        },
      },
    });
    if (!event) {
      return new GeneralApiResponseDto(
        HttpStatus.NOT_FOUND,
        HttpStatusDescriptions[HttpStatus.NOT_FOUND],
        null as never,
        { message: 'Событие не найдено' },
      );
    }

    const participantsCount = event.participations.length;
    const freeSpots =
      typeof event.maxParticipants === 'number'
        ? Math.max(0, event.maxParticipants - participantsCount)
        : null;
    const joinedByMe = event.participations.some((p) => p.userId === user.id);
    const canManage = await this.checkCanManage(
      user.id,
      event.creatorUserId,
      event.club?.id,
    );

    return new GeneralApiResponseDto(
      HttpStatus.OK,
      HttpStatusDescriptions[HttpStatus.OK],
      new EventDetailResDto({
        id: event.id,
        title: event.title,
        description: event.description,
        locationOrLink: event.locationOrLink,
        status: this.eventStatusService.calculate({
          status: event.status,
          startsAtUtc: event.startsAtUtc,
          endsAtUtc: event.endsAtUtc,
        }),
        startsAtUtc: event.startsAtUtc,
        endsAtUtc: event.endsAtUtc,
        maxParticipants: event.maxParticipants ?? null,
        participantsCount,
        freeSpots,
        creatorTelegramUserId: event.creator.telegramUserId.toString(),
        creatorName: event.creator.fullName,
        clubId: event.club?.id ?? null,
        clubTitle: event.club?.title ?? null,
        tags: event.tags.map((t) => t.tag),
        coverSeed: event.coverSeed ?? null,
        joinedByMe,
        canManage,
      }),
    );
  }

  private async checkCanManage(
    userId: string,
    creatorUserId: string,
    clubId: string | undefined,
  ): Promise<boolean> {
    if (creatorUserId === userId) return true;

    const [isPlatformAdmin, isClubAdmin] = await Promise.all([
      this.userContextService.hasRole(userId, AppRole.PlatformAdmin),
      this.userContextService.hasRole(userId, AppRole.ClubAdmin),
    ]);
    if (isPlatformAdmin || isClubAdmin) return true;

    if (!clubId) return false;

    const membership = await this.prisma.clubMembership.findUnique({
      where: { clubId_userId: { clubId, userId } },
      select: { role: true, status: true },
    });
    return (
      membership?.status === 'joined' &&
      (membership.role === 'owner' ||
        membership.role === 'admin' ||
        membership.role === 'event_manager')
    );
  }
}
