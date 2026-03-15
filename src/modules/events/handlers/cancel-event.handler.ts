import { HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AnalyticsService } from '@analytics/analytics.service';
import { ReminderSchedulerService } from '@jobs/reminders/reminder.scheduler.service';
import { PointsService } from '@points/points.service';
import { EventParticipationStatus, EventStatus } from '@shared/domain';
import { AppException } from '@shared/exceptions';
import { PrismaService } from '@shared/prisma';
import { StatusResDto } from '@shared/types';
import { UserContextService } from '@shared/user-context';

import { CancelEventCommand } from '../commands';
import { EventStatusService } from '../event-status.service';

@CommandHandler(CancelEventCommand)
export class CancelEventHandler implements ICommandHandler<CancelEventCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
    private readonly pointsService: PointsService,
    private readonly analyticsService: AnalyticsService,
    private readonly eventStatusService: EventStatusService,
    private readonly reminderScheduler: ReminderSchedulerService,
  ) {}

  async execute(command: CancelEventCommand): Promise<StatusResDto> {
    const { telegramUserId, eventId } = command;
    const user =
      await this.userContextService.requireUserByTelegram(telegramUserId);

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        participations: {
          where: { status: EventParticipationStatus.Joined },
          select: { userId: true },
        },
      },
    });
    if (!event || event.isDeleted) {
      throw new AppException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Событие не найдено',
      });
    }

    if (event.creatorUserId !== user.id) {
      const canManage = await this.userContextService.canManageClubEvent(
        user.id,
        event.clubId,
      );
      if (!canManage) {
        throw new AppException({
          statusCode: HttpStatus.FORBIDDEN,
          message: 'Недостаточно прав для управления событием',
        });
      }
    }

    // Идемпотентность: уже отменённое событие
    const computedStatus = this.eventStatusService.calculate({
      status: event.status,
      startsAtUtc: event.startsAtUtc,
      endsAtUtc: event.endsAtUtc,
    });
    if (computedStatus === EventStatus.Cancelled) {
      return {
        status: EventStatus.Cancelled,
      };
    }

    await this.prisma.event.update({
      where: { id: eventId },
      data: { status: EventStatus.Cancelled },
    });

    // Откатываем очки организатора
    await this.pointsService.rollbackByReference(
      user.id,
      `event_create_${eventId}`,
      'event_create_rollback',
    );

    // Откатываем очки и напоминания всех участников
    for (const participant of event.participations) {
      await this.reminderScheduler.cancelStartReminder(
        eventId,
        participant.userId,
      );
      await this.pointsService.rollbackEventParticipation(
        participant.userId,
        eventId,
      );
    }

    void this.analyticsService.track({
      eventName: 'event.cancel',
      entityType: 'event',
      entityId: eventId,
    });

    return {
      status: EventStatus.Cancelled,
    };
  }
}
