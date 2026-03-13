import { HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AnalyticsService } from '@analytics/analytics.service';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { HttpStatusDescriptions } from '@shared/constants';
import { GeneralApiResponseDto } from '@shared/dto';
import { StatusResDto } from '@shared/types';
import { AppException } from '@shared/exceptions';
import { PrismaService } from '@shared/prisma';
import { UserContextService } from '@shared/user-context';

import { FollowCommand } from '../commands';

@CommandHandler(FollowCommand)
export class FollowHandler implements ICommandHandler<FollowCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
    private readonly notificationsService: NotificationsService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async execute(
    command: FollowCommand,
  ): Promise<GeneralApiResponseDto<StatusResDto>> {
    const { telegramUserId, targetTelegramUserId } = command;
    const user =
      await this.userContextService.requireUserByTelegram(telegramUserId);

    const target = await this.prisma.user.findUnique({
      where: { telegramUserId: BigInt(targetTelegramUserId) },
      select: { id: true, fullName: true },
    });
    if (!target) {
      throw new AppException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Пользователь не найден',
      });
    }
    if (target.id === user.id) {
      throw new AppException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Нельзя подписаться на себя',
      });
    }

    // Проверяем существующую подписку для решения об отправке уведомления
    const existing = await this.prisma.connection.findUnique({
      where: {
        followerUserId_followedUserId: {
          followerUserId: user.id,
          followedUserId: target.id,
        },
      },
      select: { followerUserId: true },
    });

    await this.prisma.connection.upsert({
      where: {
        followerUserId_followedUserId: {
          followerUserId: user.id,
          followedUserId: target.id,
        },
      },
      update: {},
      create: { followerUserId: user.id, followedUserId: target.id },
    });

    if (!existing) {
      void this.notificationsService.createInAppNotification({
        userId: target.id,
        type: 'new_follower',
        title: 'Новый подписчик',
        body: 'На вас подписался новый пользователь',
      });
    }

    void this.analyticsService.track({
      eventName: 'connection.follow',
      context: { targetTelegramUserId },
    });

    return new GeneralApiResponseDto(
      HttpStatus.OK,
      HttpStatusDescriptions[HttpStatus.OK],
      {
        status: 'followed',
      },
    );
  }
}
