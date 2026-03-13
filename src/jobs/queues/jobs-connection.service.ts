import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

import { QueueName } from '../queue.types';

/**
 * Сервис управления подключениями к BullMQ очередям.
 *
 * Инициализирует все очереди при старте приложения на основе REDIS_URL.
 * Предоставляет метод getQueue() для получения конкретной очереди по имени.
 */
@Injectable()
export class JobsConnectionService {
  private readonly queues = new Map<QueueName, Queue>();
  private readonly connection: { host: string; port: number };

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    const parsedUrl = new URL(redisUrl ?? 'redis://localhost:6379');
    this.connection = {
      host: parsedUrl.hostname,
      port: Number(parsedUrl.port || 6379),
    };

    this.initializeQueues();
  }

  /** Возвращает очередь по имени. Бросает ошибку если очередь не инициализирована */
  getQueue(name: QueueName): Queue {
    const queue = this.queues.get(name);
    if (!queue) {
      throw new Error(`Queue ${name} is not initialized`);
    }
    return queue;
  }

  /** Закрывает все соединения с очередями при завершении приложения */
  async close(): Promise<void> {
    for (const queue of this.queues.values()) {
      try {
        await queue.close();
      } catch {
        // Игнорируем ошибки при закрытии в процессе остановки
      }
    }
  }

  private initializeQueues(): void {
    const queueNames: QueueName[] = [
      'otp-send',
      'reminders',
      'event-changed',
      'retention-cleanup',
      'dead-letter',
    ];

    for (const queueName of queueNames) {
      this.queues.set(
        queueName,
        new Queue(queueName, {
          connection: this.connection,
          defaultJobOptions: {
            attempts: 5,
            backoff: {
              type: 'exponential',
              delay: 2_000,
            },
            removeOnComplete: 500,
            removeOnFail: 1_000,
          },
        }),
      );
    }
  }
}
