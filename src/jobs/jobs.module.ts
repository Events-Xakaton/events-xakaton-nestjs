import { Module } from '@nestjs/common';

import { QueueService } from './queue.service';
import { JobsConnectionService } from './queues/jobs-connection.service';
import { ReminderSchedulerService } from './reminders/reminder.scheduler.service';
import { BaseWorker } from './workers/base.worker';

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
