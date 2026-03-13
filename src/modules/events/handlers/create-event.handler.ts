import { HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AnalyticsService } from '@analytics/analytics.service';
import { PointsService } from '@points/points.service';
import { AppRole } from '@shared/auth';
import { HttpStatusDescriptions } from '@shared/constants';
import { GeneralApiResponseDto } from '@shared/dto';
import { PrismaService } from '@shared/prisma';
import { UserContextService } from '@shared/user-context';

import { CreateEventCommand } from '../commands';

@CommandHandler(CreateEventCommand)
export class CreateEventHandler implements ICommandHandler<CreateEventCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
    private readonly pointsService: PointsService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async execute(
    command: CreateEventCommand,
  ): Promise<GeneralApiResponseDto<{ id: string }>> {
    const { telegramUserId, dto } = command;
    const user =
      await this.userContextService.requireUserByTelegram(telegramUserId);

    const startsAt = new Date(dto.startsAtUtc);
    const endsAt = new Date(dto.endsAtUtc);
    if (endsAt.getTime() <= startsAt.getTime()) {
      return new GeneralApiResponseDto(
        HttpStatus.BAD_REQUEST,
        HttpStatusDescriptions[HttpStatus.BAD_REQUEST],
        null as never,
        { message: 'Время окончания события должно быть позже начала' },
      );
    }

    if (dto.clubId) {
      const club = await this.prisma.club.findFirst({
        where: { id: dto.clubId, isDeleted: false },
        select: { id: true, creatorUserId: true },
      });
      if (!club) {
        return new GeneralApiResponseDto(
          HttpStatus.NOT_FOUND,
          HttpStatusDescriptions[HttpStatus.NOT_FOUND],
          null as never,
          { message: 'Клуб не найден' },
        );
      }
      if (
        !(await this.canCreateClubEvent(user.id, club.id, club.creatorUserId))
      ) {
        return new GeneralApiResponseDto(
          HttpStatus.FORBIDDEN,
          HttpStatusDescriptions[HttpStatus.FORBIDDEN],
          null as never,
          { message: 'Недостаточно прав для создания событий в этом клубе' },
        );
      }
    }

    const tags = [...new Set(dto.tags ?? [])];
    if (tags.length > 3) {
      return new GeneralApiResponseDto(
        HttpStatus.BAD_REQUEST,
        HttpStatusDescriptions[HttpStatus.BAD_REQUEST],
        null as never,
        { message: 'Слишком много тегов' },
      );
    }

    const event = await this.prisma.event.create({
      data: {
        clubId: dto.clubId,
        creatorUserId: user.id,
        title: dto.title,
        description: dto.description,
        locationOrLink: dto.locationOrLink,
        startsAtUtc: startsAt,
        endsAtUtc: endsAt,
        coverSeed: dto.coverSeed,
        maxParticipants: dto.maxParticipants,
        status: 'upcoming',
        tags: { create: tags.map((tag) => ({ tag })) },
      },
      select: { id: true },
    });

    await this.pointsService.award({
      userId: user.id,
      ruleCode: 'event_create',
      deltaPoints: 8,
      referenceId: `event_create_${event.id}`,
      eventId: event.id,
      clubId: dto.clubId,
    });

    void this.analyticsService.track({
      eventName: 'event.create',
      entityType: 'event',
      entityId: event.id,
    });

    return new GeneralApiResponseDto(
      HttpStatus.CREATED,
      HttpStatusDescriptions[HttpStatus.CREATED],
      {
        id: event.id,
      },
    );
  }

  private async canCreateClubEvent(
    userId: string,
    clubId: string,
    clubCreatorUserId: string,
  ): Promise<boolean> {
    if (clubCreatorUserId === userId) return true;

    const [isPlatformAdmin, isClubAdmin, membership] = await Promise.all([
      this.userContextService.hasRole(userId, AppRole.PlatformAdmin),
      this.userContextService.hasRole(userId, AppRole.ClubAdmin),
      this.prisma.clubMembership.findUnique({
        where: { clubId_userId: { clubId, userId } },
        select: { role: true, status: true },
      }),
    ]);
    if (isPlatformAdmin || isClubAdmin) return true;

    return (
      membership?.status === 'joined' &&
      (membership.role === 'owner' ||
        membership.role === 'admin' ||
        membership.role === 'event_manager')
    );
  }
}
