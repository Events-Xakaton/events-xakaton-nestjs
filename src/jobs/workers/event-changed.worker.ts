import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Worker } from 'bullmq';

import { NotificationsService } from '../../modules/notifications/notifications.service';
import { ReddySendService } from '../../reddy-bot/reddy.send.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { EventChangedJobPayload } from '../queue.types';
import { BaseWorker } from './base.worker';

/**
 * Worker для уведомления участников об изменении события.
 *
 * Срабатывает когда организатор меняет время начала или место проведения.
 * Для каждого участника:
 * 1. Создаёт in-app уведомление через NotificationsService
 * 2. Если у участника привязан аккаунт Reddy — отправляет сообщение в мессенджер
 */
@Injectable()
export class EventChangedWorker implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker;

  constructor(
    @Inject(BaseWorker) private readonly baseWorker: BaseWorker,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationsService)
    private readonly notificationsService: NotificationsService,
    @Inject(ReddySendService)
    private readonly reddySendService: ReddySendService,
  ) {}

  onModuleInit(): void {
    this.worker = this.baseWorker.create<EventChangedJobPayload['payload']>(
      'event-changed',
      async ({
        participantIds,
        eventId,
        eventTitle,
        changedFields,
        nextStartsAtUtc,
        nextLocationOrLink,
      }) => {
        if (!eventId || participantIds.length === 0) {
          return;
        }

        const hasStartsAt =
          changedFields.includes('startsAtUtc') && Boolean(nextStartsAtUtc);
        const hasLocation =
          changedFields.includes('locationOrLink') &&
          Boolean(nextLocationOrLink);
        if (!hasStartsAt && !hasLocation) {
          return;
        }

        const bodySegments: string[] = [];
        if (hasStartsAt) {
          bodySegments.push(`Новое время: **${nextStartsAtUtc}**`);
        }
        if (hasLocation) {
          bodySegments.push(`Новая локация: **${nextLocationOrLink}**`);
        }
        const body = `**${eventTitle}**:\n${bodySegments.join('\n')}`;

        for (const userId of participantIds) {
          await this.notificationsService.createInAppNotification({
            userId,
            type: 'event_changed',
            title: 'Изменения в ивенте',
            body,
            targetType: 'event',
            targetId: eventId,
          });

          // Отправляем уведомление в Reddy если у участника привязан аккаунт
          const binding = await this.prisma.identityBinding.findUnique({
            where: { userId },
            select: { reddyUserKey: true },
          });
          if (binding?.reddyUserKey) {
            await this.reddySendService.sendDirectMessage(
              binding.reddyUserKey,
              `Ивент "${eventTitle}" обновлен:\n${bodySegments.join('\n')}`,
            );
          }
        }
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      try {
        await this.worker.close();
      } catch {
        // Игнорируем ошибки при закрытии в процессе остановки
      }
    }
  }
}
