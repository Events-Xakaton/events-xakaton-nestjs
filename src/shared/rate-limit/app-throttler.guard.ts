import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Расширение стандартного ThrottlerGuard.
 *
 * Ключ троттлинга = telegramUserId:deviceId:ip.
 * Это позволяет лимитировать запросы per-user, а не per-IP,
 * что важно для сценариев с NAT (несколько пользователей за одним IP).
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const headers = (req.headers as Record<string, string | undefined>) ?? {};
    const deviceId = headers['x-device-id'] ?? 'no-device';
    const telegramUserId =
      (req.telegramUserId as string | undefined) ??
      headers['x-telegram-user-id'] ??
      'anon';
    const ip =
      (req.ip as string | undefined) ?? headers['x-forwarded-for'] ?? 'no-ip';

    return Promise.resolve(`${telegramUserId}:${deviceId}:${ip}`);
  }

  protected shouldSkip(context: ExecutionContext): Promise<boolean> {
    // Telegraf-обработчики не имеют HTTP-контекста — пропускаем троттлинг
    return Promise.resolve(context.getType() !== 'http');
  }
}
