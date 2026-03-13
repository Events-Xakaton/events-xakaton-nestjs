import { HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AnalyticsService } from '@analytics/analytics.service';
import { QueueService } from '@jobs/queue.service';
import { HttpStatusDescriptions } from '@shared/constants';
import { GeneralApiResponseDto } from '@shared/dto';
import { AppException } from '@shared/exceptions';
import { UserContextService } from '@shared/user-context';

import { RequestCodeCommand } from '../commands';
import { ReddyIdentityService } from '../reddy-identity.service';
import { VerificationService } from '../verification.service';

@CommandHandler(RequestCodeCommand)
export class RequestCodeHandler implements ICommandHandler<RequestCodeCommand> {
  constructor(
    private readonly userContextService: UserContextService,
    private readonly reddyIdentityService: ReddyIdentityService,
    private readonly verificationService: VerificationService,
    private readonly queueService: QueueService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async execute(
    command: RequestCodeCommand,
  ): Promise<GeneralApiResponseDto<{ status: string; ttlSec: number }>> {
    const { telegramUserId, reddyUserKey } = command;

    if (!reddyUserKey || !String(reddyUserKey).trim()) {
      throw new AppException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Ключ Reddy обязателен',
      });
    }

    const user =
      await this.userContextService.requireUserByTelegram(telegramUserId);

    const reddyUser = await this.reddyIdentityService.resolve(reddyUserKey);
    if (!reddyUser.id) {
      throw new AppException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Пользователь Reddy не найден',
      });
    }

    // VerificationService.createSession может бросить UnauthorizedException/429 —
    // эти HttpException обрабатываются GeneralExceptionFilter напрямую
    const { code } = await this.verificationService.createSession(
      user.id,
      reddyUserKey,
    );

    const message = `Код подтверждения для Events в Telegram: [b]${code}[/b].\nЕсли вы не запрашивали, игнорируйте это сообщение.`;
    await this.queueService.enqueue(
      'otp-send',
      { type: 'otp-send', payload: { reddyUserKey, message } },
      `otp:${user.id}:${reddyUserKey}:${code}`,
    );

    void this.analyticsService.track({
      eventName: 'auth.request_code',
      context: { reddyUserKeyProvided: Boolean(reddyUserKey) },
    });

    return new GeneralApiResponseDto(
      HttpStatus.OK,
      HttpStatusDescriptions[HttpStatus.OK],
      {
        status: 'code_requested',
        ttlSec: 60,
      },
    );
  }
}
