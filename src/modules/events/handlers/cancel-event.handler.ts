import { HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AnalyticsService } from '@analytics/analytics.service';
import { ReminderSchedulerService } from '@jobs/reminders/reminder.scheduler.service';
import { PointsService } from '@points/points.service';
import { AppRole } from '@shared/auth';
import { HttpStatusDescriptions } from '@shared/constants';
import { GeneralApiResponseDto } from '@shared/dto';
import { PrismaService } from '@shared/prisma';
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

  async execute(
    command: CancelEventCommand,
  ): Promise<GeneralApiResponseDto<{ status: string }>> {
    const { telegramUserId, eventId } = command;
    const user =
      await this.userContextService.requireUserByTelegram(telegramUserId);

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        participations: {
          where: { status: 'joined' },
          select: { userId: true },
        },
      },
    });
    if (!event || event.isDeleted) {
      return new GeneralApiResponseDto(
        HttpStatus.NOT_FOUND,
        HttpStatusDescriptions[HttpStatus.NOT_FOUND],
        null as never,
        { message: 'Событие не найдено' },
      );
    }

    if (event.creatorUserId !== user.id) {
      const canManage = await this.checkCanManage(user.id, event.clubId);
      if (!canManage) {
        return new GeneralApiResponseDto(
          HttpStatus.FORBIDDEN,
          HttpStatusDescriptions[HttpStatus.FORBIDDEN],
          null as never,
          { message: 'Недостаточно прав для управления событием' },
        );
      }
    }

    // Идемпотентность: уже отменённое событие
    const computedStatus = this.eventStatusService.calculate({
      status: event.status,
      startsAtUtc: event.startsAtUtc,
      endsAtUtc: event.endsAtUtc,
    });
    if (computedStatus === 'cancelled') {
      return new GeneralApiResponseDto(
        HttpStatus.OK,
        HttpStatusDescriptions[HttpStatus.OK],
        {
          status: 'cancelled',
        },
      );
    }

    await this.prisma.event.update({
      where: { id: eventId },
      data: { status: 'cancelled' },
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
      await this.pointsService.rollbackByReference(
        participant.userId,
        `event_join_${eventId}_${participant.userId}`,
        'event_join_rollback',
      );
      await this.pointsService.rollbackByReference(
        participant.userId,
        `attendance_${eventId}_${participant.userId}`,
        'attendance_rollback',
      );
    }

    void this.analyticsService.track({
      eventName: 'event.cancel',
      entityType: 'event',
      entityId: eventId,
    });

    return new GeneralApiResponseDto(
      HttpStatus.OK,
      HttpStatusDescriptions[HttpStatus.OK],
      {
        status: 'cancelled',
      },
    );
  }

  private async checkCanManage(
    userId: string,
    clubId: string | null,
  ): Promise<boolean> {
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
