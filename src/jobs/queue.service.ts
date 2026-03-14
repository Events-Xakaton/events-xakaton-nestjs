import { Inject, Injectable, OnModuleDestroy, Optional } from '@nestjs/common';

import { JobsConnectionService } from '@jobs/queues';
import { MetricsService } from '@observability/metrics.service';
import { AppConfigService, EnvVariableName } from '@shared/config';

import { QueueJobPayload, QueueName } from './queue.types';

/**
 * Высокоуровневый сервис для постановки задач в очереди BullMQ.
 *
 * Особенности:
 * - Дедупликация задач по dedupKey (jobId в BullMQ): повторный enqueue с тем же ключом игнорируется
 * - Автоматический retry (5 попыток, экспоненциальный backoff с базой 2с)
 * - Перемещение в DLQ (dead-letter queue) после исчерпания попыток
 * - Запись метрик Prometheus при наличии ObservabilityModule
 */
@Injectable()
export class QueueService implements OnModuleDestroy {
  constructor(
    @Inject(AppConfigService)
    private readonly appConfigService: AppConfigService,
    @Inject(JobsConnectionService)
    private readonly connectionService: JobsConnectionService,
    @Optional()
    @Inject(MetricsService)
    private readonly metricsService?: MetricsService,
  ) {}

  /**
   * Добавляет задачу в очередь.
   *
   * @param queueName - имя очереди
   * @param data - payload задачи
   * @param dedupKey - ключ дедупликации; одновременно существует только одна задача с таким ключом
   * @param options - дополнительные опции (delayMs для отложенного выполнения)
   */
  async enqueue(
    queueName: QueueName,
    data: QueueJobPayload,
    dedupKey: string,
    options?: {
      delayMs?: number;
    },
  ): Promise<void> {
    const queue = this.connectionService.getQueue(queueName);
    const safeJobId = this.normalizeJobId(dedupKey);
    try {
      await queue.add(data.type, data.payload, {
        jobId: safeJobId,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 2_000,
        },
        delay: options?.delayMs ?? 0,
        removeOnComplete: 500,
        removeOnFail: 1_000,
      });
    } catch (error) {
      // BullMQ бросает ошибку если задача с таким jobId уже существует — это нормально
      if (!this.isDuplicateJobError(error)) {
        throw error;
      }
    }
    this.metricsService?.incQueueEnqueue(queueName);
    const [waiting, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getDelayedCount(),
    ]);
    this.metricsService?.setQueueDepth(queueName, waiting + delayed);
  }

  /**
   * Удаляет задачу из очереди по dedupKey.
   * Используется для отмены напоминаний при выходе пользователя из события.
   *
   * @returns true если задача была найдена и удалена, false если задача не существует
   */
  async removeByDedupKey(
    queueName: QueueName,
    dedupKey: string,
  ): Promise<boolean> {
    const queue = this.connectionService.getQueue(queueName);
    const safeJobId = this.normalizeJobId(dedupKey);
    const job = await queue.getJob(safeJobId);
    if (!job) {
      return false;
    }
    await job.remove();
    const [waiting, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getDelayedCount(),
    ]);
    this.metricsService?.setQueueDepth(queueName, waiting + delayed);
    return true;
  }

  getDeadLetterQueueName(): QueueName {
    const value = this.appConfigService.get(EnvVariableName.DLQ_NAME);
    return (value as QueueName) || 'dead-letter';
  }

  async onModuleDestroy(): Promise<void> {
    await this.connectionService.close();
  }

  /** Нормализует ключ для использования как jobId в BullMQ (только safe символы) */
  private normalizeJobId(raw: string): string {
    return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  }

  private isDuplicateJobError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }
    return /job.*already exists|job is already/i.test(error.message);
  }
}
