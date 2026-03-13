import { HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AnalyticsService } from '@analytics/analytics.service';
import { HttpStatusDescriptions } from '@shared/constants';
import { GeneralApiResponseDto } from '@shared/dto';
import { StatusResDto } from '@shared/types';
import { AppException } from '@shared/exceptions';
import { PrismaService } from '@shared/prisma';
import { UserContextService } from '@shared/user-context';

import { UnfollowCommand } from '../commands';

@CommandHandler(UnfollowCommand)
export class UnfollowHandler implements ICommandHandler<UnfollowCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async execute(
    command: UnfollowCommand,
  ): Promise<GeneralApiResponseDto<StatusResDto>> {
    const { telegramUserId, targetTelegramUserId } = command;
    const user =
      await this.userContextService.requireUserByTelegram(telegramUserId);

    const target = await this.prisma.user.findUnique({
      where: { telegramUserId: BigInt(targetTelegramUserId) },
      select: { id: true },
    });
    if (!target) {
      throw new AppException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Пользователь не найден',
      });
    }

    await this.prisma.connection.deleteMany({
      where: { followerUserId: user.id, followedUserId: target.id },
    });

    void this.analyticsService.track({
      eventName: 'connection.unfollow',
      context: { targetTelegramUserId },
    });

    return new GeneralApiResponseDto(
      HttpStatus.OK,
      HttpStatusDescriptions[HttpStatus.OK],
      {
        status: 'unfollowed',
      },
    );
  }
}
