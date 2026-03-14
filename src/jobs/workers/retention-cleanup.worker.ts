import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Worker } from 'bullmq';

import { NotificationsService } from '@modules/notifications/notifications.service';

import { BaseWorker } from './base.worker';

/**
 * Worker для периодической очистки старых уведомлений.
 * Запускается раз в сутки через RetentionCleanupScheduler.
 * Удаляет уведомления старше 90 дней.
 */
@Injectable()
export class RetentionCleanupWorker implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker;

  constructor(
    @Inject(BaseWorker) private readonly baseWorker: BaseWorker,
    @Inject(NotificationsService)
    private readonly notificationsService: NotificationsService,
  ) {}

  onModuleInit(): void {
    this.worker = this.baseWorker.create('retention-cleanup', async () => {
      await this.notificationsService.cleanupExpired(90);
    });
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
