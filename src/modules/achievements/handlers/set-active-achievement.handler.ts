import { HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AppException } from '@shared/exceptions';
import { PrismaService } from '@shared/prisma';
import { OkStatusResDto } from '@shared/types';
import { UserContextService } from '@shared/user-context';

import { SetActiveAchievementCommand } from '../commands';

@CommandHandler(SetActiveAchievementCommand)
export class SetActiveAchievementHandler implements ICommandHandler<SetActiveAchievementCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
  ) {}

  async execute(command: SetActiveAchievementCommand): Promise<OkStatusResDto> {
    const user = await this.userContextService.requireUserByTelegram(
      command.telegramUserId,
    );

    if (command.achievementId !== null) {
      const earned = await this.prisma.userAchievement.findUnique({
        where: {
          userId_achievementId: {
            userId: user.id,
            achievementId: command.achievementId,
          },
        },
        select: { achievementId: true },
      });

      if (!earned) {
        throw new AppException({
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Достижение не найдено или не получено',
        });
      }
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { activeAchievementId: command.achievementId },
    });

    return { status: 'ok' };
  }
}
