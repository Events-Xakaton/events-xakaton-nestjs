import { HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AnalyticsService } from '@analytics/analytics.service';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { PointsService } from '@points/points.service';
import { POINTS } from '@shared/constants';
import { AppException } from '@shared/exceptions';
import { PrismaService } from '@shared/prisma';
import { StatusResDto } from '@shared/types';
import { UserContextService } from '@shared/user-context';

import { FollowCommand } from '../commands';

@CommandHandler(FollowCommand)
export class FollowHandler implements ICommandHandler<FollowCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
    private readonly notificationsService: NotificationsService,
    private readonly analyticsService: AnalyticsService,
    private readonly pointsService: PointsService,
  ) {}

  async execute(
    command: FollowCommand,
  ): Promise<StatusResDto> {
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

    // Проверяем существующую подписку для решения об отправке уведомления и очков
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

      // Начисляем очки тому, на кого подписались
      void this.pointsService.award({
        userId: target.id,
        ruleCode: 'follower_gained',
        deltaPoints: POINTS.FOLLOWER_GAINED,
        referenceId: `follower_gained_${user.id}_${target.id}`,
      });
    }

    void this.analyticsService.track({
      eventName: 'connection.follow',
      context: { targetTelegramUserId },
    });

    return {
      status: 'followed',
    };
  }
}
