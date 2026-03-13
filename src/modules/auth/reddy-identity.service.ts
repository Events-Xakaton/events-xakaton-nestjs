import { Injectable, Logger } from '@nestjs/common';

import { ReddyClient } from '../../reddy-bot/reddy.client';

/** TTL кэша идентификаторов Reddy в памяти процесса */
const REDDY_IDENTITY_CACHE_TTL_MS = 5 * 60 * 1000;
/** Таймаут одного запроса к Reddy findUser (мс) — деградация не должна блокировать авторизацию */
const REDDY_FIND_USER_TIMEOUT_MS = 600;

/**
 * Инфраструктурный сервис для разрешения Reddy-идентичности по ключу пользователя.
 *
 * Хранит in-memory кэш результатов findUser с TTL, чтобы снизить нагрузку на Reddy API.
 * При недоступности Reddy возвращает fallback-идентификатор "userkey:<key>",
 * чтобы не блокировать процесс авторизации.
 */
@Injectable()
export class ReddyIdentityService {
  private readonly logger = new Logger(ReddyIdentityService.name);

  private readonly cache = new Map<
    string,
    { value: { id: string; userKey: string }; expiresAt: number }
  >();

  constructor(private readonly reddyClient: ReddyClient) {}

  async resolve(
    reddyUserKey: string,
  ): Promise<{ id: string; userKey: string }> {
    const cached = this.cache.get(reddyUserKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    try {
      const resolved = await this.reddyClient.findUser(reddyUserKey, {
        timeoutMs: REDDY_FIND_USER_TIMEOUT_MS,
        disableRetries: true,
      });
      this.store(reddyUserKey, resolved);
      return resolved;
    } catch (error) {
      const responseStatus =
        typeof error === 'object' && error !== null && 'response' in error
          ? Number(
              (error as { response?: { status?: unknown } }).response?.status,
            )
          : NaN;
      const message = error instanceof Error ? error.message : String(error);
      const isTimeout =
        message.includes('timeout') || message.includes('ECONNABORTED');
      const isNetwork =
        message.includes('ECONNRESET') ||
        message.includes('ENOTFOUND') ||
        message.includes('EAI_AGAIN');
      const is404 =
        responseStatus === 404 ||
        message.includes('status 404') ||
        message.includes('status code 404') ||
        /(^|\s)404(\s|$)/.test(message);
      const is429 =
        responseStatus === 429 ||
        message.includes('status 429') ||
        message.includes('status code 429') ||
        /(^|\s)429(\s|$)/.test(message);

      if (is404 || is429 || isTimeout || isNetwork) {
        const reason = is429
          ? '429'
          : is404
            ? '404'
            : isTimeout
              ? 'timeout'
              : 'network';
        this.logger.warn(
          `Reddy findUser degraded for userKey=${reddyUserKey} (${reason}), fallback to userKey identity`,
        );
        const fallback = {
          id: `userkey:${reddyUserKey}`,
          userKey: reddyUserKey,
        };
        this.store(reddyUserKey, fallback);
        return fallback;
      }
      throw error;
    }
  }

  private store(userKey: string, value: { id: string; userKey: string }): void {
    this.cache.set(userKey, {
      value,
      expiresAt: Date.now() + REDDY_IDENTITY_CACHE_TTL_MS,
    });
  }
}
