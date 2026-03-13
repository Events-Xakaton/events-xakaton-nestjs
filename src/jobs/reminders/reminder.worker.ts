import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Worker } from 'bullmq';

import { NotificationsService } from '@modules/notifications/notifications.service';

import { ReminderJobPayload } from '../queue.types';
import { BaseWorker } from '../workers/base.worker';

/**
 * Worker для обработки напоминаний о начале событий.
 *
 * Создаёт in-app уведомление за 2 часа до старта события.
 * Время отправки задаётся через delayMs в ReminderSchedulerService.
 */
@Injectable()
export class ReminderWorker implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker;

  constructor(
    @Inject(BaseWorker) private readonly baseWorker: BaseWorker,
    @Inject(NotificationsService)
    private readonly notificationsService: NotificationsService,
  ) {}

  onModuleInit(): void {
    this.worker = this.baseWorker.create<ReminderJobPayload['payload']>(
      'reminders',
      async ({ userId, eventId, eventTitle, startsAtUtc }) => {
        if (!userId || !eventId) {
          return;
        }

        const startTime = new Date(startsAtUtc).toLocaleTimeString('ru', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'UTC',
        });

        await this.notificationsService.createInAppNotification({
          userId,
          type: 'reminder',
          title: 'Напоминание о событии',
          body: `Ивент «${eventTitle}» начнётся в ${startTime} UTC`,
          targetType: 'event',
          targetId: eventId,
        });
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
