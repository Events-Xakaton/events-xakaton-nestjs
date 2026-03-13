import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';

import { JobsConnectionService } from '@jobs/queues';
import { MetricsService } from '@observability/metrics.service';

import { QueueName } from '../queue.types';

/**
 * Базовый фабричный класс для BullMQ workers.
 *
 * Создаёт Worker для указанной очереди с единым обработчиком ошибок:
 * - логирует failed jobs
 * - записывает метрики (если ObservabilityModule включён)
 * - перемещает задачу в DLQ после исчерпания всех попыток
 */
@Injectable()
export class BaseWorker {
  private readonly logger = new Logger(BaseWorker.name);
  /** Имя Dead-Letter Queue для задач, исчерпавших все попытки */
  private readonly dlqName: QueueName = 'dead-letter';

  constructor(
    @Inject(JobsConnectionService)
    private readonly connectionService: JobsConnectionService,
    @Optional()
    @Inject(MetricsService)
    private readonly metricsService?: MetricsService,
  ) {}

  /**
   * Создаёт BullMQ Worker для указанной очереди.
   *
   * @param queueName - имя очереди
   * @param handler - типизированная функция обработки задачи; T соответствует payload конкретной очереди
   */
  create<T = Record<string, unknown>>(
    queueName: QueueName,
    handler: (data: T) => Promise<void>,
  ): Worker {
    const queue = this.connectionService.getQueue(queueName);
    const worker = new Worker(
      queueName,
      async (job) => {
        await handler(job.data as T);
      },
      {
        connection: queue.opts.connection,
      },
    );

    worker.on('failed', (job, error) => {
      if (!job) {
        return;
      }
      this.logger.error(
        `Job failed queue=${queueName} jobId=${job.id} attempts=${job.attemptsMade}`,
        error?.stack,
      );
      this.metricsService?.incQueueFailed(queueName);

      // После исчерпания всех попыток перемещаем задачу в DLQ для ручного разбора
      if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
        this.moveToDlq(
          job.name,
          job.data as Record<string, unknown>,
          job.id ?? '',
        ).catch((dlqError: unknown) => {
          this.logger.error('Failed to move job to DLQ', dlqError);
        });
      }
    });

    worker.on('completed', () => {
      this.metricsService?.incQueueCompleted(queueName);
      const queueRef = this.connectionService.getQueue(queueName);
      Promise.all([queueRef.getWaitingCount(), queueRef.getDelayedCount()])
        .then(([waiting, delayed]) => {
          this.metricsService?.setQueueDepth(queueName, waiting + delayed);
        })
        .catch(() => {
          // Игнорируем ошибки метрик при закрытии в процессе остановки
        });
    });

    return worker;
  }

  /** Перемещает задачу в Dead-Letter Queue с сохранением оригинального payload */
  private async moveToDlq(
    jobName: string,
    payload: Record<string, unknown>,
    sourceJobId: string,
  ): Promise<void> {
    const deadLetterQueue: Queue = this.connectionService.getQueue(
      this.dlqName,
    );
    const safeSourceJobId = String(sourceJobId)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 120);
    await deadLetterQueue.add(
      `dlq-${jobName}`,
      {
        sourceJobId,
        payload,
      },
      {
        jobId: `dlq_${safeSourceJobId}`,
      },
    );
  }
}
