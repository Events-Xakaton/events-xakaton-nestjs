import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import * as speakeasy from 'speakeasy';

import { PrismaService } from '@shared/prisma/prisma.service';

const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 0.5;
const OTP_MAX_ATTEMPTS = 7;
const OTP_MAX_RESENDS = 5;
const OTP_COOLDOWN_MINUTES = 5;
const OTP_RESEND_INTERVAL_SECONDS = 10;
/** Намеренно нейтральное сообщение — не раскрывает причину отказа */
const NEUTRAL_OTP_ERROR = 'Код неверный или истек';

/**
 * Управляет жизненным циклом OTP-сессий верификации через Reddy.
 *
 * Безопасность:
 * - Код хранится только как SHA-256 хэш (не в открытом виде)
 * - После исчерпания попыток сессия блокируется на OTP_COOLDOWN_MINUTES
 * - Все сообщения об ошибках нейтральны (не раскрывают причину)
 */
@Injectable()
export class VerificationService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Создаёт новую OTP-сессию для пары (userId, reddyUserKey).
   * Предыдущие активные сессии для той же пары помечаются как expired.
   *
   * @returns Сгенерированный OTP-код и дата истечения (для логирования, не для API)
   * @throws UnauthorizedException — если сессия заблокирована по cooldown или исчерпаны resend
   * @throws HttpException(429) — если повторная отправка запрошена слишком быстро
   */
  async createSession(
    userId: string,
    reddyUserKey: string,
  ): Promise<{ code: string; expiresAt: Date }> {
    const now = Date.now();
    const lastActiveSession = await this.prisma.verificationSession.findFirst({
      where: {
        userId,
        reddyUserKey,
        status: 'active',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (
      lastActiveSession?.cooldownUntil &&
      lastActiveSession.cooldownUntil.getTime() > now
    ) {
      throw new UnauthorizedException(NEUTRAL_OTP_ERROR);
    }
    if (
      lastActiveSession &&
      now - lastActiveSession.createdAt.getTime() <
        OTP_RESEND_INTERVAL_SECONDS * 1000
    ) {
      throw new HttpException(
        'Повторная отправка доступна через 10 секунд',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (lastActiveSession?.resendLeft === 0) {
      throw new UnauthorizedException(NEUTRAL_OTP_ERROR);
    }

    const code = this.generateCode();
    const hash = this.hashCode(code);
    const expiresAt = new Date(now + OTP_TTL_MINUTES * 600_000);
    const nextResendLeft =
      typeof lastActiveSession?.resendLeft === 'number'
        ? Math.max(0, lastActiveSession.resendLeft - 1)
        : OTP_MAX_RESENDS;

    // Инвалидируем предыдущие активные сессии перед созданием новой
    await this.prisma.verificationSession.updateMany({
      where: {
        userId,
        reddyUserKey,
        status: 'active',
      },
      data: {
        status: 'expired',
      },
    });

    await this.prisma.verificationSession.create({
      data: {
        userId,
        reddyUserKey,
        otpCodeHash: hash,
        expiresAt,
        attemptsLeft: OTP_MAX_ATTEMPTS,
        resendLeft: nextResendLeft,
      },
    });

    return { code, expiresAt };
  }

  /**
   * Проверяет введённый OTP-код и при успехе создаёт/обновляет привязку identity.
   *
   * Rebind-семантика: существующие привязки по userId, reddyUserKey или reddyUserId удаляются
   * перед созданием новой — один пользователь может быть привязан только к одному Reddy-аккаунту.
   *
   * @throws UnauthorizedException — при неверном коде, истёкшей или заблокированной сессии
   */
  async verifyCode(params: {
    userId: string;
    reddyUserKey: string;
    inputCode: string;
    reddyUserId: string;
  }): Promise<void> {
    const session = await this.prisma.verificationSession.findFirst({
      where: {
        userId: params.userId,
        reddyUserKey: params.reddyUserKey,
        status: 'active',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!session || session.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException(NEUTRAL_OTP_ERROR);
    }

    if (session.cooldownUntil && session.cooldownUntil.getTime() > Date.now()) {
      throw new UnauthorizedException(NEUTRAL_OTP_ERROR);
    }

    const hash = this.hashCode(params.inputCode);
    if (hash !== session.otpCodeHash) {
      const attemptsLeft = session.attemptsLeft - 1;
      await this.prisma.verificationSession.update({
        where: { id: session.id },
        data: {
          attemptsLeft: Math.max(0, attemptsLeft),
          cooldownUntil:
            attemptsLeft <= 0
              ? new Date(Date.now() + OTP_COOLDOWN_MINUTES * 30_000)
              : session.cooldownUntil,
          status: attemptsLeft <= 0 ? 'blocked' : 'active',
        },
      });
      throw new UnauthorizedException(NEUTRAL_OTP_ERROR);
    }

    await this.prisma.$transaction(async (tx) => {
      const deleteWhere = {
        OR: [
          { userId: params.userId },
          { reddyUserKey: params.reddyUserKey },
          { reddyUserId: params.reddyUserId },
        ],
      };

      // Удаляем все существующие привязки для обеспечения уникальности
      await tx.identityBinding.deleteMany({
        where: deleteWhere,
      });

      await tx.identityBinding.create({
        data: {
          userId: params.userId,
          reddyUserKey: params.reddyUserKey,
          reddyUserId: params.reddyUserId,
          verifiedAt: new Date(),
        },
      });

      await tx.user.update({
        where: { id: params.userId },
        data: { isVerified: true },
      });

      await tx.verificationSession.update({
        where: { id: session.id },
        data: {
          status: 'verified',
          attemptsLeft: 0,
        },
      });

      await tx.verificationSession.updateMany({
        where: {
          userId: params.userId,
          id: { not: session.id },
          status: 'active',
        },
        data: { status: 'expired' },
      });
    });
  }

  /** Генерирует случайный 6-значный OTP через TOTP с одноразовым секретом */
  private generateCode(): string {
    const secret = speakeasy.generateSecret({ length: 20 });
    const token = speakeasy.totp({
      secret: secret.base32,
      encoding: 'base32',
      digits: OTP_LENGTH,
    });
    return token;
  }

  /** SHA-256 хэш кода — именно он хранится в БД вместо открытого текста */
  private hashCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }
}
