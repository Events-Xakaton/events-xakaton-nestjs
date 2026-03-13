import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { AnalyticsModule } from '../../analytics/analytics.module';
import { JobsModule } from '../../jobs/jobs.module';
import { EventChangedWorker } from '../../jobs/workers/event-changed.worker';
import { ReddyModule } from '../../reddy-bot/reddy.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventStatusService } from './event-status.service';
import { EventsController } from './events.controller';
import {
  CancelEventHandler,
  CreateEventHandler,
  GetEventHandler,
  GetRandomEventHandler,
  JoinEventHandler,
  ListEventParticipantsHandler,
  ListEventsHandler,
  SubmitEventFeedbackHandler,
  UnjoinEventHandler,
  UpdateEventHandler,
} from './handlers';

const handlers = [
  CreateEventHandler,
  UpdateEventHandler,
  CancelEventHandler,
  JoinEventHandler,
  UnjoinEventHandler,
  SubmitEventFeedbackHandler,
  ListEventsHandler,
  GetEventHandler,
  ListEventParticipantsHandler,
  GetRandomEventHandler,
];

@Module({
  imports: [
    CqrsModule,
    JobsModule,
    NotificationsModule,
    ReddyModule,
    AnalyticsModule,
  ],
  controllers: [EventsController],
  providers: [EventStatusService, EventChangedWorker, ...handlers],
})
export class EventsModule {}
