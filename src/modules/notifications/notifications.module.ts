import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { JobsModule } from '@jobs/jobs.module';
import { ReminderWorker } from '@jobs/reminders/reminder.worker';
import { RetentionCleanupWorker } from '@jobs/workers/retention-cleanup.worker';

import {
  ListNotificationsHandler,
  MarkNotificationReadHandler,
} from './handlers';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationRetentionScheduler } from './retention.scheduler';

const handlers = [ListNotificationsHandler, MarkNotificationReadHandler];

@Module({
  imports: [CqrsModule, JobsModule],
  controllers: [NotificationsController],
  providers: [
    ...handlers,
    // NotificationsService остаётся: его createInAppNotification используют clubs, events, connections
    NotificationsService,
    NotificationRetentionScheduler,
    RetentionCleanupWorker,
    // ReminderWorker здесь: он инжектирует NotificationsService, а JobsModule не может его импортировать
    // из-за того что NotificationsModule → JobsModule (иначе цикл)
    ReminderWorker,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
