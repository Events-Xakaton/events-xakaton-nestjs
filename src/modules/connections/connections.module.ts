import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { AnalyticsModule } from '../../analytics/analytics.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ConnectionsController } from './connections.controller';
import {
  FollowHandler,
  ListFollowingHandler,
  UnfollowHandler,
} from './handlers';

const handlers = [ListFollowingHandler, FollowHandler, UnfollowHandler];

@Module({
  imports: [CqrsModule, AnalyticsModule, NotificationsModule],
  controllers: [ConnectionsController],
  providers: handlers,
})
export class ConnectionsModule {}
