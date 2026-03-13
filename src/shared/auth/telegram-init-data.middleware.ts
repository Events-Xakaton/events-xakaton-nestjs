import {
  Inject,
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parse, validate } from '@tma.js/init-data-node';
import { NextFunction, Request, Response } from 'express';

import { PrismaService } from '../prisma/prisma.service';

/**
 * Middleware для валидации Telegram initData.
 *
 * В production: требует заголовок x-telegram-init-data, проверяет подпись и срок действия (24ч).
 * В development: принимает упрощённый заголовок x-telegram-user-id без подписи (для локального тестирования).
 *
 * После успешной валидации синхронизирует профиль пользователя из Telegram (имя, username, аватар)
 * и добавляет telegramUserId в объект запроса.
 */
@Injectable()
export class TelegramInitDataMiddleware implements NestMiddleware {
  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    if (req.method === 'OPTIONS') {
      next();
      return;
    }

    // Health и metrics не требуют аутентификации
    if (
      req.path === '/health' ||
      req.path === '/metrics' ||
      req.originalUrl.endsWith('/api/health') ||
      req.originalUrl.endsWith('/api/metrics')
    ) {
      next();
      return;
    }

    const nodeEnv = this.configService.get<string>('NODE_ENV') ?? 'development';
    const initData = req.header('x-telegram-init-data');

    if (!initData) {
      // В dev-режиме позволяем передать просто числовой userId без подписи
      if (nodeEnv !== 'production') {
        const fallbackUserId = req.header('x-telegram-user-id');
        if (fallbackUserId) {
          (req as Request & { telegramUserId?: string }).telegramUserId =
            fallbackUserId;
          next();
          return;
        }
      }
      throw new UnauthorizedException('Отсутствуют данные Telegram initData');
    }

    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      throw new UnauthorizedException('Токен Telegram-бота не настроен');
    }

    try {
      // Проверяем HMAC-подпись и что initData не старше 24 часов
      validate(initData, botToken, { expiresIn: 86400 });
    } catch {
      throw new UnauthorizedException('Некорректные данные Telegram initData');
    }

    const parsedData = parse(initData);
    if (!parsedData.user?.id) {
      throw new UnauthorizedException(
        'Пользователь Telegram отсутствует в initData',
      );
    }

    await this.syncUserProfile(parsedData.user);

    (req as Request & { telegramUserId?: string }).telegramUserId = String(
      parsedData.user.id,
    );
    next();
  }

  /**
   * Синхронизирует профиль пользователя из Telegram initData.
   * Создаёт пользователя если не существует, обновляет имя/аватар при каждом входе.
   */
  private async syncUserProfile(user: {
    id: number;
    username?: string;
    firstName?: string;
    lastName?: string;
    photoUrl?: string;
  }): Promise<void> {
    const telegramUserId = BigInt(user.id);
    const firstName = (user.firstName ?? '').trim();
    const lastName = (user.lastName ?? '').trim();
    const fullName =
      `${firstName} ${lastName}`.trim() ||
      user.username?.trim() ||
      `tg-${user.id}`;

    await this.prisma.user.upsert({
      where: { telegramUserId },
      update: {
        fullName,
        telegramUsername: user.username ?? null,
        avatarUrl: user.photoUrl ?? null,
      },
      create: {
        telegramUserId,
        fullName,
        telegramUsername: user.username ?? null,
        avatarUrl: user.photoUrl ?? null,
      },
      select: { id: true },
    });
  }
}
