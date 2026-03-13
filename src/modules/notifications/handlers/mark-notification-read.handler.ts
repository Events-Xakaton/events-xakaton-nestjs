import { HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { HttpStatusDescriptions } from '@shared/constants';
import { GeneralApiResponseDto } from '@shared/dto';
import { PrismaService } from '@shared/prisma';
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
  ): Promise<GeneralApiResponseDto<{ status: 'ok' }>> {
    const user = await this.userContextService.requireUserByTelegram(
      command.telegramUserId,
    );

    const exists = await this.prisma.notification.findFirst({
      where: { id: command.notificationId, userId: user.id },
      select: { id: true },
    });
    if (!exists) {
      return new GeneralApiResponseDto(
        HttpStatus.NOT_FOUND,
        'Уведомление не найдено',
        null as never,
      );
    }

    await this.prisma.notification.update({
      where: { id: command.notificationId },
      data: { isRead: true },
    });

    return new GeneralApiResponseDto(
      HttpStatus.OK,
      HttpStatusDescriptions[HttpStatus.OK],
      {
        status: 'ok' as const,
      },
    );
  }
}
