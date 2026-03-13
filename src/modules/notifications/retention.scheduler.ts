import { Inject, Injectable, OnModuleInit } from '@nestjs/common';

import { JobsConnectionService } from '../../jobs/queues/jobs-connection.service';

/**
 * Регистрирует повторяющееся задание очистки старых уведомлений при старте модуля.
 * jobId фиксированный — дубли не создаются при рестарте.
 */
@Injectable()
export class NotificationRetentionScheduler implements OnModuleInit {
  constructor(
    @Inject(JobsConnectionService)
    private readonly jobsConnectionService: JobsConnectionService,
  ) {}

  async onModuleInit(): Promise<void> {
    const queue = this.jobsConnectionService.getQueue('retention-cleanup');
    await queue.add(
      'retention-cleanup',
      {},
      {
        jobId: 'retention_cleanup_daily',
        repeat: { every: 24 * 60 * 60 * 1000 },
        removeOnComplete: 20,
        removeOnFail: 20,
      },
    );
  }
}
