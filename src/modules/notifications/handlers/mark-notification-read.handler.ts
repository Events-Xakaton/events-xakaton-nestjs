import { HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AppException } from '@shared/exceptions';
import { PrismaService } from '@shared/prisma';
import { OkStatusResDto } from '@shared/types';
import { UserContextService } from '@shared/user-context';

import { MarkNotificationReadCommand } from '../commands';

@CommandHandler(MarkNotificationReadCommand)
export class MarkNotificationReadHandler implements ICommandHandler<MarkNotificationReadCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
  ) {}

  async execute(
    command: MarkNotificationReadCommand,
  ): Promise<OkStatusResDto> {
    const user = await this.userContextService.requireUserByTelegram(
      command.telegramUserId,
    );

    const exists = await this.prisma.notification.findFirst({
      where: { id: command.notificationId, userId: user.id },
      select: { id: true },
    });
    if (!exists) {
      throw new AppException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Уведомление не найдено',
      });
    }

    await this.prisma.notification.update({
      where: { id: command.notificationId },
      data: { isRead: true },
    });

    return {
      status: 'ok' as const,
    };
  }
}
