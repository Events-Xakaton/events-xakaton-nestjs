import { HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AnalyticsService } from '@analytics/analytics.service';
import { ReminderSchedulerService } from '@jobs/reminders/reminder.scheduler.service';
import { PointsService } from '@points/points.service';
import { HttpStatusDescriptions } from '@shared/constants';
import { GeneralApiResponseDto } from '@shared/dto';
import { PrismaService } from '@shared/prisma';
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

  async execute(
    command: UnjoinEventCommand,
  ): Promise<GeneralApiResponseDto<{ status: string }>> {
    const { telegramUserId, eventId } = command;
    const user =
      await this.userContextService.requireUserByTelegram(telegramUserId);

    const participation = await this.prisma.eventParticipation.findUnique({
      where: { eventId_userId: { eventId, userId: user.id } },
    });
    if (!participation) {
      return new GeneralApiResponseDto(
        HttpStatus.NOT_FOUND,
        HttpStatusDescriptions[HttpStatus.NOT_FOUND],
        null as never,
        { message: 'Участие в событии не найдено' },
      );
    }

    await this.prisma.eventParticipation.update({
      where: { eventId_userId: { eventId, userId: user.id } },
      data: { status: 'left' },
    });

    await this.pointsService.rollbackByReference(
      user.id,
      `event_join_${eventId}_${user.id}`,
      'event_join_rollback',
    );
    await this.pointsService.rollbackByReference(
      user.id,
      `attendance_${eventId}_${user.id}`,
      'attendance_rollback',
    );
    await this.reminderScheduler.cancelStartReminder(eventId, user.id);

    void this.analyticsService.track({
      eventName: 'event.unjoin',
      entityType: 'event',
      entityId: eventId,
    });

    return new GeneralApiResponseDto(
      HttpStatus.OK,
      HttpStatusDescriptions[HttpStatus.OK],
      {
        status: 'left',
      },
    );
  }
}
