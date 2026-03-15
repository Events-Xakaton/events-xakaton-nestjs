import { HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AnalyticsService } from '@analytics/analytics.service';
import { ReminderSchedulerService } from '@jobs/reminders/reminder.scheduler.service';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { PointsService } from '@points/points.service';
import { POINTS, RANKS } from '@shared/constants';
import { EventParticipationStatus, EventStatus } from '@shared/domain';
import { AppException } from '@shared/exceptions';
import { PrismaService } from '@shared/prisma';
import { computeRank } from '@shared/utils/compute-rank';
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
  ): Promise<StatusResDto> {
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

    if (event.minLevel !== null) {
      // Lucky Wheel — проверяем использование механики сегодня, ценз снимается
      const isLuckyBypass =
        command.lucky &&
        (await this.prisma.luckyWheelUsage.findUnique({
          where: {
            userId_dayKey: {
              userId: user.id,
              dayKey: new Date().toISOString().slice(0, 10),
            },
          },
        })) !== null;

      if (!isLuckyBypass) {
        const ledger = await this.prisma.pointsLedger.aggregate({
          where: { userId: user.id },
          _sum: { deltaPoints: true },
        });
        const lifetimePoints = ledger._sum.deltaPoints ?? 0;
        const userLevel = computeRank(lifetimePoints).level;

        if (userLevel < event.minLevel) {
          const requiredRank = RANKS.find((r) => r.level === event.minLevel);
          throw new AppException({
            statusCode: HttpStatus.FORBIDDEN,
            message: `Для записи на это событие нужен уровень ${event.minLevel} · ${requiredRank?.title ?? ''}`,
          });
        }
      }
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

    // Бонус за первое в жизни событие — идемпотентен по фиксированному referenceId
    void this.pointsService.award({
      userId: user.id,
      ruleCode: 'first_event_join',
      deltaPoints: POINTS.FIRST_EVENT_JOIN,
      referenceId: `first_event_join_${user.id}`,
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

    return {
      status: EventParticipationStatus.Joined,
    };
  }
}
