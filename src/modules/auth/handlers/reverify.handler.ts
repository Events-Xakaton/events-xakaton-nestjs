import { HttpStatus } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AnalyticsService } from '@analytics/analytics.service';
import { AppException } from '@shared/exceptions';
import { PrismaService } from '@shared/prisma';

import { RequestCodeCommand, ReverifyCommand } from '../commands';
import { OtpRequestedResDto } from '../dto/response';

@CommandHandler(ReverifyCommand)
export class ReverifyHandler implements ICommandHandler<ReverifyCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analyticsService: AnalyticsService,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(
    command: ReverifyCommand,
  ): Promise<OtpRequestedResDto> {
    const { telegramUserId } = command;

    const user = await this.prisma.user.findUnique({
      where: { telegramUserId: BigInt(telegramUserId) },
      select: { id: true },
    });
    if (!user) {
      throw new AppException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Сессия подтверждения не найдена',
      });
    }

    const binding = await this.prisma.identityBinding.findUnique({
      where: { userId: user.id },
      select: { reddyUserKey: true },
    });
    if (!binding) {
      throw new AppException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Сессия подтверждения не найдена',
      });
    }

    void this.analyticsService.track({
      eventName: 'auth.reverify_request_code',
    });

    return this.commandBus.execute(
      new RequestCodeCommand(telegramUserId, binding.reddyUserKey),
    );
  }
}
