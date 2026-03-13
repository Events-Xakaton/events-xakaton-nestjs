import {
  ConflictException,
  Inject,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

import { RedisService } from '../redis/redis.service';

const IDEMPOTENCY_TTL_SECONDS = 60 * 10; // 10 минут
const IDEMPOTENCY_HEADER = 'idempotency-key';

/**
 * Middleware защиты от дублирующих запросов.
 *
 * Применяется только к критическим write-операциям (join, leave, follow, create и т.д.).
 * Требует заголовок idempotency-key на таких запросах.
 *
 * Принцип: ключ = scope:method:path:idempotency-key записывается в Redis на 10 минут.
 * Повторный запрос с тем же ключом получает 409 Conflict.
 *
 * Scope = telegramUserId пользователя (или IP как fallback).
 */
@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  constructor(
    @Inject(RedisService) private readonly redisService: RedisService,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    if (!this.isCriticalWrite(req)) {
      next();
      return;
    }

    const key = req.header(IDEMPOTENCY_HEADER);
    if (!key) {
      throw new ConflictException(
        `Header ${IDEMPOTENCY_HEADER} is required for this operation`,
      );
    }

    const scope = this.resolveScope(req);
    const redisKey = `idem:${scope}:${req.method}:${req.path}:${key}`;

    // SET NX — установить только если ключ не существует
    const setResult = await this.redisService
      .getClient()
      .set(redisKey, '1', 'EX', IDEMPOTENCY_TTL_SECONDS, 'NX');

    if (setResult !== 'OK') {
      throw new ConflictException('Обнаружен дублирующий запрос');
    }

    next();
  }

  private resolveScope(req: Request): string {
    const userHeader = req.header('x-telegram-user-id');
    if (userHeader) {
      return `u:${userHeader}`;
    }
    return `ip:${req.ip ?? 'unknown'}`;
  }

  /** Проверяет, является ли запрос критической write-операцией, требующей идемпотентности */
  private isCriticalWrite(req: Request): boolean {
    const method = req.method.toUpperCase();
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      return false;
    }

    return /\/(join|leave|unjoin|follow|clubs|events|comments|feedback|auth\/request-code|auth\/verify-code|auth\/re-verify)/.test(
      req.path,
    );
  }
}
