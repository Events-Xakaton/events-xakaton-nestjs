import { HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AnalyticsService } from '@analytics/analytics.service';
import { QueueService } from '@jobs/queue.service';
import { ReminderSchedulerService } from '@jobs/reminders/reminder.scheduler.service';
import {
  ClubMembershipRole,
  ClubMembershipStatus,
  EventParticipationStatus,
  EventStatus,
} from '@shared/domain';
import { AppException } from '@shared/exceptions';
import { PrismaService } from '@shared/prisma';
import { StatusResDto } from '@shared/types';
import { UserContextService } from '@shared/user-context';

import { UpdateEventCommand } from '../commands';
import { EventStatusService } from '../event-status.service';

@CommandHandler(UpdateEventCommand)
export class UpdateEventHandler implements ICommandHandler<UpdateEventCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
    private readonly analyticsService: AnalyticsService,
    private readonly eventStatusService: EventStatusService,
    private readonly queueService: QueueService,
    private readonly reminderScheduler: ReminderSchedulerService,
  ) {}

  async execute(command: UpdateEventCommand): Promise<StatusResDto> {
    const { telegramUserId, eventId, dto } = command;
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

    const computedStatus = this.eventStatusService.calculate({
      status: event.status,
      startsAtUtc: event.startsAtUtc,
      endsAtUtc: event.endsAtUtc,
    });
    if (computedStatus === EventStatus.Past) {
      throw new AppException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Прошедшее событие нельзя редактировать',
      });
    }

    const nextStarts = dto.startsAtUtc
      ? new Date(dto.startsAtUtc)
      : event.startsAtUtc;
    const nextEnds = dto.endsAtUtc ? new Date(dto.endsAtUtc) : event.endsAtUtc;
    this.eventStatusService.assertEndsAfterStarts(nextStarts, nextEnds);

    let nextClubId: string | null | undefined;
    if (Object.prototype.hasOwnProperty.call(dto, 'clubId')) {
      if (dto.clubId === null) {
        nextClubId = null;
      } else if (dto.clubId) {
        const targetClub = await this.prisma.club.findFirst({
          where: { id: dto.clubId, isDeleted: false },
          select: { id: true },
        });
        if (!targetClub) {
          throw new AppException({
            statusCode: HttpStatus.NOT_FOUND,
            message: 'Клуб не найден',
          });
        }
        const canBindToClub = await this.hasClubOwnerRights(
          user.id,
          dto.clubId,
        );
        if (!canBindToClub) {
          throw new AppException({
            statusCode: HttpStatus.FORBIDDEN,
            message: 'Только владелец клуба может привязать событие к клубу',
          });
        }
        nextClubId = dto.clubId;
      }
    }

    // Определяем изменённые поля для уведомления участников
    const isStartsAtChanged =
      Object.prototype.hasOwnProperty.call(dto, 'startsAtUtc') &&
      Boolean(dto.startsAtUtc) &&
      dto.startsAtUtc !== event.startsAtUtc.toISOString();
    const isLocationChanged =
      Object.prototype.hasOwnProperty.call(dto, 'locationOrLink') &&
      typeof dto.locationOrLink === 'string' &&
      dto.locationOrLink !== event.locationOrLink;
    const isMinLevelChanged =
      Object.prototype.hasOwnProperty.call(dto, 'minLevel') &&
      (dto.minLevel ?? null) !== (event.minLevel ?? null);

    await this.prisma.event.update({
      where: { id: eventId },
      data: {
        title: dto.title ?? undefined,
        description: dto.description ?? undefined,
        locationOrLink: dto.locationOrLink ?? undefined,
        startsAtUtc: dto.startsAtUtc ? new Date(dto.startsAtUtc) : undefined,
        endsAtUtc: dto.endsAtUtc ? new Date(dto.endsAtUtc) : undefined,
        maxParticipants: dto.maxParticipants ?? undefined,
        coverSeed: dto.coverSeed ?? undefined,
        clubId: nextClubId,
        ...(Object.prototype.hasOwnProperty.call(dto, 'minLevel') && { minLevel: dto.minLevel ?? null }),
      },
    });

    // Уведомляем участников при смене времени, места или ценза уровня
    if (isStartsAtChanged || isLocationChanged || isMinLevelChanged) {
      const changedFields = [
        ...(isStartsAtChanged ? ['startsAtUtc'] : []),
        ...(isLocationChanged ? ['locationOrLink'] : []),
        ...(isMinLevelChanged ? ['minLevel'] : []),
      ];
      const participants = event.participations
        .filter((p) => p.userId !== user.id)
        .map((p) => p.userId);
      await this.queueService.enqueue(
        'event-changed',
        {
          type: 'event-changed',
          payload: {
            participantIds: participants,
            eventId,
            eventTitle: dto.title ?? event.title,
            changedFields,
            nextStartsAtUtc: isStartsAtChanged
              ? (dto.startsAtUtc ?? null)
              : null,
            nextLocationOrLink: isLocationChanged
              ? (dto.locationOrLink ?? null)
              : null,
            nextMinLevel: isMinLevelChanged ? (dto.minLevel ?? null) : undefined,
          },
        },
        `event_changed_${eventId}_${Date.now()}`,
      );
    }

    // Перепланируем напоминания при смене времени начала
    if (dto.startsAtUtc) {
      const nextStartsAt = new Date(dto.startsAtUtc);
      for (const participant of event.participations) {
        await this.reminderScheduler.scheduleStartReminder({
          eventId,
          userId: participant.userId,
          eventTitle: dto.title ?? event.title,
          startsAtUtc: nextStartsAt,
        });
      }
    }

    void this.analyticsService.track({
      eventName: 'event.update',
      entityType: 'event',
      entityId: eventId,
    });

    return {
      status: 'updated',
    };
  }

  private async hasClubOwnerRights(
    userId: string,
    clubId: string,
  ): Promise<boolean> {
    const club = await this.prisma.club.findFirst({
      where: { id: clubId, isDeleted: false },
      select: { creatorUserId: true },
    });
    if (!club) return false;
    if (club.creatorUserId === userId) return true;

    const membership = await this.prisma.clubMembership.findUnique({
      where: { clubId_userId: { clubId, userId } },
      select: { role: true, status: true },
    });
    const status = membership?.status as ClubMembershipStatus | undefined;
    const role = membership?.role as ClubMembershipRole | undefined;
    return (
      status === ClubMembershipStatus.Joined &&
      role === ClubMembershipRole.Owner
    );
  }
}
