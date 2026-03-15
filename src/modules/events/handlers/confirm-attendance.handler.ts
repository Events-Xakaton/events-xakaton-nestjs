import { HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AchievementCheckerService } from '@modules/achievements/achievement-checker.service';
import { TelegramNotificationService } from '@modules/bot/telegram-notification.service';
import { PointsService } from '@points/points.service';
import { EventParticipationStatus, EventStatus } from '@shared/domain';
import { AppException } from '@shared/exceptions';
import { PrismaService } from '@shared/prisma';
import { UserContextService } from '@shared/user-context';

import { ConfirmAttendanceCommand } from '../commands';
import { ConfirmAttendanceResDto } from '../dto/response';
import { EventStatusService } from '../event-status.service';

@CommandHandler(ConfirmAttendanceCommand)
export class ConfirmAttendanceHandler implements ICommandHandler<ConfirmAttendanceCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
    private readonly eventStatusService: EventStatusService,
    private readonly pointsService: PointsService,
    private readonly telegramNotification: TelegramNotificationService,
    private readonly achievementChecker: AchievementCheckerService,
  ) {}

  async execute(
    command: ConfirmAttendanceCommand,
  ): Promise<ConfirmAttendanceResDto> {
    const { telegramUserId, eventId, dto } = command;

    const user =
      await this.userContextService.requireUserByTelegram(telegramUserId);

    const event = await this.prisma.event.findFirst({
      where: { id: eventId, isDeleted: false },
      select: {
        id: true,
        title: true,
        status: true,
        startsAtUtc: true,
        endsAtUtc: true,
        creatorUserId: true,
      },
    });

    if (!event) {
      throw new AppException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Событие не найдено',
      });
    }

    if (event.creatorUserId !== user.id) {
      throw new AppException({
        statusCode: HttpStatus.FORBIDDEN,
        message: 'Только создатель события может подтверждать присутствие',
      });
    }

    const computedStatus = this.eventStatusService.calculate({
      status: event.status,
      startsAtUtc: event.startsAtUtc,
      endsAtUtc: event.endsAtUtc,
    });

    if (computedStatus !== EventStatus.Past) {
      throw new AppException({
        statusCode: HttpStatus.BAD_REQUEST,
        message:
          'Подтверждение присутствия доступно только для завершённых событий',
      });
    }

    // Повторная отправка запрещена
    const existingCount = await this.prisma.attendanceConfirmation.count({
      where: { eventId },
    });
    if (existingCount > 0) {
      throw new AppException({
        statusCode: HttpStatus.CONFLICT,
        message: 'Подтверждения для этого события уже были отправлены',
      });
    }

    // Загружаем joined-участников для матчинга
    const joinedParticipants = await this.prisma.eventParticipation.findMany({
      where: { eventId, status: EventParticipationStatus.Joined },
      select: {
        userId: true,
        user: { select: { telegramUserId: true } },
      },
    });

    const joinedUserIds = new Set(joinedParticipants.map((p) => p.userId));
    const participantTelegramMap = new Map(
      joinedParticipants.map((p) => [p.userId, p.user.telegramUserId]),
    );

    let confirmedCount = 0;
    for (const item of dto.attendances) {
      // Игнорируем userId, которые не являются участниками события
      if (!joinedUserIds.has(item.userId)) continue;
      confirmedCount++;

      await this.prisma.attendanceConfirmation.create({
        data: {
          eventId,
          userId: item.userId,
          rating: item.rating ?? null,
        },
      });

      if (item.rating !== undefined) {
        await this.pointsService.award({
          userId: item.userId,
          ruleCode: 'attendance_feedback',
          deltaPoints: item.rating,
          referenceId: eventId,
          eventId,
        });
      }

      const telegramUserId = participantTelegramMap.get(item.userId);
      if (telegramUserId) {
        const message =
          item.rating !== undefined
            ? `⭐ Организатор подтвердил твоё присутствие на «<b>${event.title}</b>» и поставил оценку ${item.rating}/5. Начислено ${item.rating} очков!`
            : `✅ Организатор подтвердил твоё присутствие на «<b>${event.title}</b>».`;

        void this.telegramNotification.sendMessage(telegramUserId, message);
      }
    }

    const unlockedAchievements =
      await this.achievementChecker.checkOnConfirmAttendance(
        user.id,
        confirmedCount,
      );

    return { status: 'ok', unlockedAchievements };
  }
}
