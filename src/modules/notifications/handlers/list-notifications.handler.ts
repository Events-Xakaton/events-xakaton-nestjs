import { HttpStatus } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { HttpStatusDescriptions, PAGINATION } from '@shared/constants';
import { GeneralApiResponseDto } from '@shared/dto';
import { PrismaService } from '@shared/prisma';
import { UserContextService } from '@shared/user-context';

import {
  ApiNotificationTargetType,
  ApiNotificationType,
  NotificationItemResDto,
  NotificationsPageResDto,
} from '../dto/response';
import { ListNotificationsQuery } from '../queries';

@QueryHandler(ListNotificationsQuery)
export class ListNotificationsHandler implements IQueryHandler<ListNotificationsQuery> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
  ) {}

  async execute(
    query: ListNotificationsQuery,
  ): Promise<GeneralApiResponseDto<NotificationsPageResDto>> {
    const user = await this.userContextService.requireUserByTelegram(
      query.telegramUserId,
    );
    const limit = query.dto.limit ?? PAGINATION.NOTIFICATIONS_DEFAULT_LIMIT;
    const cursorDate = query.dto.cursor ? new Date(query.dto.cursor) : null;

    const notifications = await this.prisma.notification.findMany({
      where: {
        userId: user.id,
        isRead: query.dto.filter === 'unread' ? false : undefined,
        // Показываем только event_changed и new_follower, привязанные к клубу/событию
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

    // Проверяем доступность связанных сущностей (клуб/событие могут быть удалены)
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

    const items: NotificationItemResDto[] = notifications.map((n) => ({
      id: n.id,
      // new_follower переименовывается в member_joined на уровне API
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

    // Курсор = дата последней записи; клиент передаёт его в следующем запросе
    const nextCursor =
      notifications.length === limit
        ? notifications[notifications.length - 1].createdAt.toISOString()
        : null;

    return new GeneralApiResponseDto(
      HttpStatus.OK,
      HttpStatusDescriptions[HttpStatus.OK],
      {
        items,
        nextCursor,
      },
    );
  }
}
