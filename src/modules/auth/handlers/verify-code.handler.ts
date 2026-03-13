import { HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AnalyticsService } from '@analytics/analytics.service';
import { HttpStatusDescriptions } from '@shared/constants';
import { GeneralApiResponseDto } from '@shared/dto';
import { AppException } from '@shared/exceptions';
import { PrismaService } from '@shared/prisma';
import { StatusResDto } from '@shared/types';

import { VerifyCodeCommand } from '../commands';
import { ReddyIdentityService } from '../reddy-identity.service';
import { VerificationService } from '../verification.service';

@CommandHandler(VerifyCodeCommand)
export class VerifyCodeHandler implements ICommandHandler<VerifyCodeCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reddyIdentityService: ReddyIdentityService,
    private readonly verificationService: VerificationService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async execute(
    command: VerifyCodeCommand,
  ): Promise<GeneralApiResponseDto<StatusResDto>> {
    const { telegramUserId, reddyUserKey, code } = command;

    const user = await this.prisma.user.findUnique({
      where: { telegramUserId: BigInt(telegramUserId) },
    });
    if (!user) {
      throw new AppException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Сессия подтверждения не найдена',
      });
    }

    const reddyUser = await this.reddyIdentityService.resolve(reddyUserKey);

    // VerificationService.verifyCode может бросить UnauthorizedException —
    // нейтральные сообщения об ошибках обязательны по соображениям безопасности
    await this.verificationService.verifyCode({
      userId: user.id,
      reddyUserKey,
      inputCode: code,
      reddyUserId: reddyUser.id,
    });

    void this.analyticsService.track({ eventName: 'auth.verify_code_success' });

    return new GeneralApiResponseDto(
      HttpStatus.OK,
      HttpStatusDescriptions[HttpStatus.OK],
      {
        status: 'verified',
      },
    );
  }
}
