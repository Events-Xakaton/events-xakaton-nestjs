import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { NotificationsService } from '@modules/notifications/notifications.service';
import { EnvVariableName } from '@shared/config';
import { PrismaService } from '@shared/prisma';

import { AchievementResDto } from './dto/response';

/**
 * Инфраструктурный сервис проверки и выдачи достижений.
 * Аналог PointsService — вызывается из CommandHandler'ов напрямую, без CommandBus.
 * Методы возвращают список только что разблокированных достижений.
 */
@Injectable()
export class AchievementCheckerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  // ─── "Один дома" ─────────────────────────────────────────────────────────
  // Вызывается из CreateEventHandler.
  // Условие: maxParticipants === 1.
  async checkOnEventCreate(
    userId: string,
    eventData: { maxParticipants: number | null },
  ): Promise<AchievementResDto[]> {
    const unlocked: AchievementResDto[] = [];

    if (eventData.maxParticipants === 1) {
      const awarded = await this.awardIfNew(userId, 'home_alone');
      if (awarded) unlocked.push(awarded);
    }

    return unlocked;
  }

  // ─── "Первый мститель" ────────────────────────────────────────────────────
  // Вызывается из JoinEventHandler после upsert участия.
  // Условие A: первый JOIN на событие (totalCount === 1 среди всех записей).
  // Условие B: предыдущий JOIN пользователя был более 30 дней назад.
  async checkOnEventJoin(
    userId: string,
    eventId: string,
  ): Promise<AchievementResDto[]> {
    const unlocked: AchievementResDto[] = [];

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [totalCount, lastParticipation] = await Promise.all([
      // Считаем все записи для события (включая left) — если 1, то этот пользователь первый
      this.prisma.eventParticipation.count({ where: { eventId } }),
      // Последнее участие пользователя в другом событии
      this.prisma.eventParticipation.findFirst({
        where: { userId, eventId: { not: eventId } },
        orderBy: { joinedAt: 'desc' },
        select: { joinedAt: true },
      }),
    ]);

    const isFirst = totalCount === 1;
    const isAfterLongBreak =
      lastParticipation === null || lastParticipation.joinedAt < thirtyDaysAgo;

    if (isFirst || isAfterLongBreak) {
      const awarded = await this.awardIfNew(userId, 'first_avenger');
      if (awarded) unlocked.push(awarded);
    }

    return unlocked;
  }

  // ─── "Уилсон" ─────────────────────────────────────────────────────────────
  // Вызывается из ConfirmAttendanceHandler.
  // Условие: создатель подтвердил посещение, но никто из участников не был отмечен как пришедший.
  async checkOnConfirmAttendance(
    creatorUserId: string,
    confirmedCount: number,
  ): Promise<AchievementResDto[]> {
    const unlocked: AchievementResDto[] = [];

    if (confirmedCount === 0) {
      const awarded = await this.awardIfNew(creatorUserId, 'wilson');
      if (awarded) unlocked.push(awarded);
    }

    return unlocked;
  }

  // ─── Приватный хелпер ─────────────────────────────────────────────────────
  // Ищет достижение по коду, создаёт UserAchievement (skipDuplicates).
  // Возвращает DTO только если ачивка была выдана впервые.
  private async awardIfNew(
    userId: string,
    code: string,
  ): Promise<AchievementResDto | null> {
    const achievement = await this.prisma.achievement.findUnique({
      where: { code },
    });
    if (!achievement) return null;

    const result = await this.prisma.userAchievement.createMany({
      data: [{ userId, achievementId: achievement.id }],
      skipDuplicates: true,
    });

    // count === 0 означает что запись уже существовала — ачивка не новая
    if (result.count === 0) return null;

    void this.notificationsService.createInAppNotification({
      userId,
      type: 'achievement_unlocked',
      title: 'Новое достижение!',
      body: achievement.name,
    });

    const baseUrl =
      this.config.get<string>(EnvVariableName.APP_BASE_URL) ??
      'http://localhost:4000';

    return {
      id: achievement.id,
      code: achievement.code,
      name: achievement.name,
      description: achievement.description,
      iconUrl: `${baseUrl}/static/${achievement.iconPath}`,
      earnedAt: new Date().toISOString(),
      isActive: false,
    };
  }
}
