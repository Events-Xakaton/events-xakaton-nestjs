import {
  Inject,
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { parse, validate } from '@telegram-apps/init-data-node';
import { NextFunction, Request, Response } from 'express';

import { AppConfigService, EnvVariableName } from '@shared/config';
import { POINTS } from '@shared/constants';
import { PrismaService } from '@shared/prisma';
import { PointsService } from '@points/points.service';
import { AnalyticsService } from '@analytics/analytics.service';

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
    @Inject(AppConfigService)
    private readonly appConfigService: AppConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    private readonly pointsService: PointsService,
    private readonly analyticsService: AnalyticsService,
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

    const nodeEnv =
      this.appConfigService.get(EnvVariableName.NODE_ENV) ?? 'development';
    const initDataRaw = req.header('x-telegram-init-data');
    // Обрезаем ведущий "?", если клиент передаёт initData как query-string напрямую
    const initData = initDataRaw?.startsWith('?')
      ? initDataRaw.slice(1)
      : initDataRaw?.trim();

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

      throw new UnauthorizedException(initData);
    }

    const botToken = this.appConfigService.get(
      EnvVariableName.TELEGRAM_BOT_TOKEN,
    );
    if (!botToken) {
      throw new UnauthorizedException('Токен Telegram-бота не настроен');
    }

    /**
     * Выбросит ошибку при проблемах с init data
     */
    validate(initData, botToken, { expiresIn: 86400 });

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

    // Получаем текущий аватар до upsert, чтобы определить первую установку
    const existing = await this.prisma.user.findUnique({
      where: { telegramUserId },
      select: { id: true, avatarUrl: true },
    });

    const upserted = await this.prisma.user.upsert({
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

    // Начисляем очки за заполнение профиля (аватар) — один раз в жизни
    if (user.photoUrl && !existing?.avatarUrl) {
      void this.pointsService.award({
        userId: upserted.id,
        ruleCode: 'profile_complete',
        deltaPoints: POINTS.PROFILE_COMPLETE,
        referenceId: `profile_complete_${upserted.id}`,
      });
    }

    void this.syncLoginStreak(upserted.id);
  }

  /**
   * Обновляет серию ежедневных входов пользователя.
   * Идемпотентен: повторные вызовы в тот же UTC-день игнорируются.
   * При каждом кратном 3 дне начисляет один фри-спин на Lucky Wheel.
   */
  private async syncLoginStreak(userId: string): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

    const streak = await this.prisma.loginStreak.findUnique({ where: { userId } });

    if (streak?.lastLoginDay === today) return;

    const prevStreak = streak?.currentStreak ?? 0;
    const isConsecutive = streak?.lastLoginDay === yesterday;
    const newStreak = isConsecutive ? prevStreak + 1 : 1;

    await this.prisma.loginStreak.upsert({
      where: { userId },
      update: { currentStreak: newStreak, lastLoginDay: today },
      create: { userId, currentStreak: newStreak, lastLoginDay: today },
    });

    void this.analyticsService.track({
      eventName: 'user.streak_updated',
      userId,
      context: { newStreak, isConsecutive },
    });

    // Каждые 3 дня подряд — фри-спин (идемпотентно по referenceId)
    if (newStreak % 3 === 0) {
      const referenceId = `free_spin_streak_${userId}_${today}`;
      const alreadyGranted = await this.prisma.freeSpinGrant.findUnique({
        where: { referenceId },
      });
      if (!alreadyGranted) {
        await this.prisma.$transaction([
          this.prisma.freeSpinGrant.create({ data: { userId, referenceId } }),
          this.prisma.freeSpinBalance.upsert({
            where: { userId },
            update: { balance: { increment: 1 } },
            create: { userId, balance: 1 },
          }),
        ]);
        void this.analyticsService.track({
          eventName: 'user.free_spin_granted',
          userId,
          context: { streak: newStreak, dayKey: today },
        });
      }
    }
  }
}
