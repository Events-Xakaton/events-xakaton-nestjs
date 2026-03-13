import { HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AnalyticsService } from '@analytics/analytics.service';
import { ReminderSchedulerService } from '@jobs/reminders/reminder.scheduler.service';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { PointsService } from '@points/points.service';
import { HttpStatusDescriptions, POINTS } from '@shared/constants';
import { EventParticipationStatus, EventStatus } from '@shared/domain';
import { GeneralApiResponseDto } from '@shared/dto';
import { AppException } from '@shared/exceptions';
import { PrismaService } from '@shared/prisma';
import { StatusResDto } from '@shared/types';
import { UserContextService } from '@shared/user-context';

import { JoinEventCommand } from '../commands';
import { EventStatusService } from '../event-status.service';

@CommandHandler(JoinEventCommand)
export class JoinEventHandler implements ICommandHandler<JoinEventCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
    private readonly pointsService: PointsService,
    private readonly notificationsService: NotificationsService,
    private readonly analyticsService: AnalyticsService,
    private readonly eventStatusService: EventStatusService,
    private readonly reminderScheduler: ReminderSchedulerService,
  ) {}

  async execute(
    command: JoinEventCommand,
  ): Promise<GeneralApiResponseDto<StatusResDto>> {
    const { telegramUserId, eventId } = command;
    const user =
      await this.userContextService.requireUserByTelegram(telegramUserId);

    const event = await this.prisma.event.findFirst({
      where: { id: eventId, isDeleted: false },
      include: {
        participations: {
          where: { status: EventParticipationStatus.Joined },
          select: { userId: true },
        },
      },
    });
    if (!event) {
      throw new AppException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Событие не найдено',
      });
    }

    const computedStatus = this.eventStatusService.calculate({
      status: event.status,
      startsAtUtc: event.startsAtUtc,
      endsAtUtc: event.endsAtUtc,
    });
    if (
      computedStatus === EventStatus.Past ||
      computedStatus === EventStatus.Cancelled
    ) {
      throw new AppException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Нельзя записаться на событие в текущем статусе',
      });
    }
    if (
      typeof event.maxParticipants === 'number' &&
      event.participations.length >= event.maxParticipants
    ) {
      throw new AppException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Свободных мест нет',
      });
    }

    await this.prisma.eventParticipation.upsert({
      where: { eventId_userId: { eventId, userId: user.id } },
      update: { status: EventParticipationStatus.Joined },
      create: {
        eventId,
        userId: user.id,
        status: EventParticipationStatus.Joined,
      },
    });

    await this.pointsService.award({
      userId: user.id,
      ruleCode: 'event_join',
      deltaPoints: POINTS.EVENT_JOIN,
      referenceId: `event_join_${eventId}_${user.id}`,
      eventId,
    });

    await this.reminderScheduler.scheduleStartReminder({
      eventId,
      userId: user.id,
      eventTitle: event.title,
      startsAtUtc: event.startsAtUtc,
    });

    if (event.creatorUserId !== user.id) {
      const actor = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { fullName: true },
      });
      void this.notificationsService.createInAppNotification({
        userId: event.creatorUserId,
        type: 'new_follower',
        title: 'Новый участник',
        body: `Новый участник: **${actor?.fullName ?? 'Пользователь'}** в **${event.title}**`,
        targetType: 'event',
        targetId: eventId,
      });
    }

    void this.analyticsService.track({
      eventName: 'event.join',
      entityType: 'event',
      entityId: eventId,
    });

    return new GeneralApiResponseDto(
      HttpStatus.OK,
      HttpStatusDescriptions[HttpStatus.OK],
      {
        status: EventParticipationStatus.Joined,
      },
    );
  }
}
