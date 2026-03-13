import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { AnalyticsModule } from '../../analytics/analytics.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ClubsController } from './clubs.controller';
import {
  CreateClubHandler,
  DeleteClubHandler,
  GetClubHandler,
  JoinClubHandler,
  LeaveClubHandler,
  ListClubEventsHandler,
  ListClubMembersHandler,
  ListClubsHandler,
  ListEventAuthoringClubsHandler,
  UpdateClubHandler,
} from './handlers';

const handlers = [
  CreateClubHandler,
  UpdateClubHandler,
  DeleteClubHandler,
  JoinClubHandler,
  LeaveClubHandler,
  ListClubsHandler,
  GetClubHandler,
  ListClubMembersHandler,
  ListClubEventsHandler,
  ListEventAuthoringClubsHandler,
];

@Module({
  imports: [CqrsModule, AnalyticsModule, NotificationsModule],
  controllers: [ClubsController],
  providers: handlers,
})
export class ClubsModule {}
