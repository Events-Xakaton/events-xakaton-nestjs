import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { AnalyticsModule } from '@analytics/analytics.module';
import { JobsModule } from '@jobs/jobs.module';
import { EventChangedWorker } from '@jobs/workers/event-changed.worker';
import { ReddyModule } from '@reddy/reddy.module';

import { BotModule } from '../bot/bot.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventStatusService } from './event-status.service';
import { EventsController } from './events.controller';
import {
  CancelEventHandler,
  ConfirmAttendanceHandler,
  CreateEventHandler,
  GetEventHandler,
  GetLuckyWheelStreakHandler,
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
  ConfirmAttendanceHandler,
  JoinEventHandler,
  UnjoinEventHandler,
  SubmitEventFeedbackHandler,
  ListEventsHandler,
  GetEventHandler,
  ListEventParticipantsHandler,
  GetRandomEventHandler,
  GetLuckyWheelStreakHandler,
];

@Module({
  imports: [
    CqrsModule,
    JobsModule,
    BotModule,
    NotificationsModule,
    ReddyModule,
    AnalyticsModule,
  ],
  controllers: [EventsController],
  providers: [EventStatusService, EventChangedWorker, ...handlers],
})
export class EventsModule {}
