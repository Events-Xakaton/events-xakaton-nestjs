import { Module } from '@nestjs/common';

import { JobsConnectionService } from '@jobs/queues';
import { ReminderSchedulerService } from '@jobs/reminders';
import { BaseWorker } from '@jobs/workers';

import { QueueService } from './queue.service';

@Module({
  providers: [
    JobsConnectionService,
    QueueService,
    BaseWorker,
    ReminderSchedulerService,
  ],
  exports: [
    QueueService,
    JobsConnectionService,
    BaseWorker,
    ReminderSchedulerService,
  ],
})
export class JobsModule {}
