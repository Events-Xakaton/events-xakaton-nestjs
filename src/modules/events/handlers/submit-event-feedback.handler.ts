import { HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AnalyticsService } from '@analytics/analytics.service';
import { PointsService } from '@points/points.service';
import { HttpStatusDescriptions } from '@shared/constants';
import { GeneralApiResponseDto } from '@shared/dto';
import { AppException } from '@shared/exceptions';
import { PrismaService } from '@shared/prisma';
import { StatusResDto } from '@shared/types';
import { UserContextService } from '@shared/user-context';

import { SubmitEventFeedbackCommand } from '../commands';

@CommandHandler(SubmitEventFeedbackCommand)
export class SubmitEventFeedbackHandler implements ICommandHandler<SubmitEventFeedbackCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
    private readonly pointsService: PointsService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async execute(
    command: SubmitEventFeedbackCommand,
  ): Promise<GeneralApiResponseDto<StatusResDto>> {
    const { telegramUserId, eventId, dto } = command;
    const user =
      await this.userContextService.requireUserByTelegram(telegramUserId);

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, startsAtUtc: true, endsAtUtc: true },
    });
    if (!event) {
      throw new AppException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Событие не найдено',
      });
    }

    const now = Date.now();
    const start = event.startsAtUtc.getTime();
    // Окно отзыва: от начала события до +48ч после окончания
    const endPlus48h = event.endsAtUtc.getTime() + 48 * 60 * 60 * 1000;
    if (now < start || now > endPlus48h) {
      throw new AppException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Окно отметки посещения закрыто',
      });
    }

    await this.prisma.eventFeedback.upsert({
      where: { eventId_userId: { eventId, userId: user.id } },
      update: { rating: dto.rating, comment: dto.comment },
      create: {
        eventId,
        userId: user.id,
        rating: dto.rating,
        comment: dto.comment,
      },
    });

    await this.pointsService.award({
      userId: user.id,
      ruleCode: 'attendance_feedback',
      deltaPoints: 4,
      referenceId: `attendance_${eventId}_${user.id}`,
      eventId,
    });

    void this.analyticsService.track({
      eventName: 'event.feedback_submit',
      entityType: 'event',
      entityId: eventId,
      context: { rating: dto.rating },
    });

    return new GeneralApiResponseDto(
      HttpStatus.OK,
      HttpStatusDescriptions[HttpStatus.OK],
      {
        status: 'feedback_saved',
      },
    );
  }
}
