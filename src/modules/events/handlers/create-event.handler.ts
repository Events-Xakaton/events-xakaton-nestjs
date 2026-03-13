import { HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AnalyticsService } from '@analytics/analytics.service';
import { PointsService } from '@points/points.service';
import { HttpStatusDescriptions, PAGINATION, POINTS } from '@shared/constants';
import { EventStatus } from '@shared/domain';
import { GeneralApiResponseDto } from '@shared/dto';
import { AppException } from '@shared/exceptions';
import { PrismaService } from '@shared/prisma';
import { IdResDto } from '@shared/types';
import { UserContextService } from '@shared/user-context';

import { CreateEventCommand } from '../commands';
import { EventStatusService } from '../event-status.service';

@CommandHandler(CreateEventCommand)
export class CreateEventHandler implements ICommandHandler<CreateEventCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
    private readonly pointsService: PointsService,
    private readonly analyticsService: AnalyticsService,
    private readonly eventStatusService: EventStatusService,
  ) {}

  async execute(
    command: CreateEventCommand,
  ): Promise<GeneralApiResponseDto<IdResDto>> {
    const { telegramUserId, dto } = command;
    const user =
      await this.userContextService.requireUserByTelegram(telegramUserId);

    const startsAt = new Date(dto.startsAtUtc);
    const endsAt = new Date(dto.endsAtUtc);
    this.eventStatusService.assertEndsAfterStarts(startsAt, endsAt);

    if (dto.clubId) {
      const club = await this.prisma.club.findFirst({
        where: { id: dto.clubId, isDeleted: false },
        select: { id: true, creatorUserId: true },
      });
      if (!club) {
        throw new AppException({
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Клуб не найден',
        });
      }
      if (
        !(await this.userContextService.canCreateClubEvent(
          user.id,
          club.id,
          club.creatorUserId,
        ))
      ) {
        throw new AppException({
          statusCode: HttpStatus.FORBIDDEN,
          message: 'Недостаточно прав для создания событий в этом клубе',
        });
      }
    }

    const tags = [...new Set(dto.tags ?? [])];
    if (tags.length > PAGINATION.MAX_TAGS_PER_ENTITY) {
      throw new AppException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Слишком много тегов',
      });
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
        status: EventStatus.Upcoming,
        tags: { create: tags.map((tag) => ({ tag })) },
      },
      select: { id: true },
    });

    await this.pointsService.award({
      userId: user.id,
      ruleCode: 'event_create',
      deltaPoints: POINTS.EVENT_CREATE,
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
}
