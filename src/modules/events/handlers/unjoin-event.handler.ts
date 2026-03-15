import { HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AnalyticsService } from '@analytics/analytics.service';
import { ReminderSchedulerService } from '@jobs/reminders/reminder.scheduler.service';
import { PointsService } from '@points/points.service';
import { EventParticipationStatus } from '@shared/domain';
import { AppException } from '@shared/exceptions';
import { PrismaService } from '@shared/prisma';
import { StatusResDto } from '@shared/types';
import { UserContextService } from '@shared/user-context';

import { UnjoinEventCommand } from '../commands';

@CommandHandler(UnjoinEventCommand)
export class UnjoinEventHandler implements ICommandHandler<UnjoinEventCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
    private readonly pointsService: PointsService,
    private readonly analyticsService: AnalyticsService,
    private readonly reminderScheduler: ReminderSchedulerService,
  ) {}

  async execute(command: UnjoinEventCommand): Promise<StatusResDto> {
    const { telegramUserId, eventId } = command;
    const user =
      await this.userContextService.requireUserByTelegram(telegramUserId);

    const participation = await this.prisma.eventParticipation.findUnique({
      where: { eventId_userId: { eventId, userId: user.id } },
    });
    if (!participation) {
      throw new AppException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Участие в событии не найдено',
      });
    }

    await this.prisma.eventParticipation.update({
      where: { eventId_userId: { eventId, userId: user.id } },
      data: { status: EventParticipationStatus.Left },
    });

    await this.pointsService.rollbackEventParticipation(user.id, eventId);
    await this.reminderScheduler.cancelStartReminder(eventId, user.id);

    void this.analyticsService.track({
      eventName: 'event.unjoin',
      entityType: 'event',
      entityId: eventId,
    });

    return {
      status: EventParticipationStatus.Left,
    };
  }
}
