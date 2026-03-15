import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { NotificationsModule } from '@modules/notifications/notifications.module';

import { AchievementCheckerService } from './achievement-checker.service';
import { AchievementsController } from './achievements.controller';
import {
  GetUserAchievementsHandler,
  SetActiveAchievementHandler,
} from './handlers';

const handlers = [GetUserAchievementsHandler, SetActiveAchievementHandler];

@Module({
  imports: [CqrsModule, NotificationsModule],
  controllers: [AchievementsController],
  providers: [...handlers, AchievementCheckerService],
  exports: [AchievementCheckerService],
})
export class AchievementsModule {}
