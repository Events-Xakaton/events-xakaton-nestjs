import { HttpStatus } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AnalyticsService } from '@analytics/analytics.service';
import { HttpStatusDescriptions } from '@shared/constants';
import { GeneralApiResponseDto } from '@shared/dto';
import { PrismaService } from '@shared/prisma';

import { RequestCodeCommand, ReverifyCommand } from '../commands';

@CommandHandler(ReverifyCommand)
export class ReverifyHandler implements ICommandHandler<ReverifyCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analyticsService: AnalyticsService,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(
    command: ReverifyCommand,
  ): Promise<GeneralApiResponseDto<{ status: string; ttlSec: number }>> {
    const { telegramUserId } = command;

    const user = await this.prisma.user.findUnique({
      where: { telegramUserId: BigInt(telegramUserId) },
      select: { id: true },
    });
    if (!user) {
      return new GeneralApiResponseDto(
        HttpStatus.BAD_REQUEST,
        HttpStatusDescriptions[HttpStatus.BAD_REQUEST],
        null as never,
        { message: 'Сессия подтверждения не найдена' },
      );
    }

    const binding = await this.prisma.identityBinding.findUnique({
      where: { userId: user.id },
      select: { reddyUserKey: true },
    });
    if (!binding) {
      return new GeneralApiResponseDto(
        HttpStatus.BAD_REQUEST,
        HttpStatusDescriptions[HttpStatus.BAD_REQUEST],
        null as never,
        { message: 'Сессия подтверждения не найдена' },
      );
    }

    void this.analyticsService.track({
      eventName: 'auth.reverify_request_code',
    });

    return this.commandBus.execute(
      new RequestCodeCommand(telegramUserId, binding.reddyUserKey),
    );
  }
}
