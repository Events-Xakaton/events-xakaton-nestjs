import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '@shared/prisma/prisma.service';
import { UserContextService } from '@shared/user-context/user-context.service';

import { ListNotificationsDto } from './dto/list-notifications.dto';

export type ApiNotificationType = 'event_changed' | 'member_joined';
export type ApiNotificationTargetType = 'club' | 'event';

/**
 * Управляет in-app уведомлениями.
 * Типы в БД: "new_follower" | "event_changed"
 * Типы в API: "member_joined" | "event_changed" (new_follower → member_joined при маппинге)
 */
@Injectable()
export class NotificationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(UserContextService)
    private readonly userContextService: UserContextService,
  ) {}

  /** Создаёт in-app уведомление. Вызывается из clubs, events, connections, workers. */
  async createInAppNotification(params: {
    userId: string;
    type: 'new_follower' | 'event_changed' | 'reminder';
    title: string;
    body: string;
    targetType?: 'club' | 'event';
    targetId?: string;
  }): Promise<void> {
    await this.prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        body: params.body,
        targetType: params.targetType,
        targetId: params.targetId,
      },
    });
  }

  /**
   * Список уведомлений пользователя с cursor-based пагинацией.
   * isTargetAvailable — проверяет, не удалён ли связанный клуб/событие.
   */
  async list(
    telegramUserId: string | undefined,
    query: ListNotificationsDto,
  ): Promise<{
    items: Array<{
      id: string;
      type: ApiNotificationType;
      title: string;
      preview: string;
      isRead: boolean;
      createdAt: Date;
      targetType: ApiNotificationTargetType | null;
      targetId: string | null;
      isTargetAvailable: boolean | null;
    }>;
    nextCursor: string | null;
  }> {
    const user =
      await this.userContextService.requireUserByTelegram(telegramUserId);
    const limit = Number(query.limit ?? 20);
    const cursorDate = query.cursor ? new Date(query.cursor) : null;

    const notifications = await this.prisma.notification.findMany({
      where: {
        userId: user.id,
        isRead: query.filter === 'unread' ? false : undefined,
        OR: [
          { type: 'event_changed' },
          { type: 'new_follower', targetType: { in: ['event', 'club'] } },
        ],
        createdAt: cursorDate ? { lt: cursorDate } : undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        isRead: true,
        createdAt: true,
        targetType: true,
        targetId: true,
      },
    });

    const eventTargetIds = notifications
      .filter((n) => n.targetType === 'event' && n.targetId)
      .map((n) => n.targetId as string);
    const clubTargetIds = notifications
      .filter((n) => n.targetType === 'club' && n.targetId)
      .map((n) => n.targetId as string);
    const [availableEvents, availableClubs] = await Promise.all([
      eventTargetIds.length > 0
        ? this.prisma.event.findMany({
            where: { id: { in: eventTargetIds }, isDeleted: false },
            select: { id: true },
          })
        : Promise.resolve([]),
      clubTargetIds.length > 0
        ? this.prisma.club.findMany({
            where: { id: { in: clubTargetIds }, isDeleted: false },
            select: { id: true },
          })
        : Promise.resolve([]),
    ]);
    const availableEventIds = new Set(availableEvents.map((e) => e.id));
    const availableClubIds = new Set(availableClubs.map((c) => c.id));

    const items = notifications.map((n) => ({
      id: n.id,
      type: (n.type === 'new_follower'
        ? 'member_joined'
        : n.type) as ApiNotificationType,
      title: n.title,
      preview: n.body,
      isRead: n.isRead,
      createdAt: n.createdAt,
      targetType: n.targetType as ApiNotificationTargetType | null,
      targetId: n.targetId,
      isTargetAvailable:
        n.targetType === 'event' && n.targetId
          ? availableEventIds.has(n.targetId)
          : n.targetType === 'club' && n.targetId
            ? availableClubIds.has(n.targetId)
            : null,
    }));

    // Курсор = дата создания последней записи — клиент передаёт его при следующем запросе
    const nextCursor =
      notifications.length === limit
        ? notifications[notifications.length - 1].createdAt.toISOString()
        : null;
    return { items, nextCursor };
  }

  /**
   * Помечает уведомление как прочитанное.
   * @throws NotFoundException если уведомление не найдено или принадлежит другому пользователю
   */
  async markRead(
    telegramUserId: string | undefined,
    notificationId: string,
  ): Promise<{ status: 'ok' }> {
    const user =
      await this.userContextService.requireUserByTelegram(telegramUserId);
    const exists = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId: user.id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException('Уведомление не найдено');
    }
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
    return { status: 'ok' };
  }

  /**
   * Удаляет уведомления старше retentionDays дней. Вызывается планировщиком.
   * @returns Количество удалённых записей
   */
  async cleanupExpired(retentionDays: number): Promise<number> {
    const threshold = new Date(
      Date.now() - retentionDays * 24 * 60 * 60 * 1000,
    );
    const result = await this.prisma.notification.deleteMany({
      where: { createdAt: { lt: threshold } },
    });
    return result.count;
  }
}
