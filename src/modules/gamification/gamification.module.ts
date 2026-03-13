import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { GamificationController } from './gamification.controller';
import {
  GetLeaderboardHandler,
  GetPointsBalanceHandler,
  GetPointsHistoryHandler,
  GetPointsRulesHandler,
} from './handlers';

const handlers = [
  GetPointsRulesHandler,
  GetPointsHistoryHandler,
  GetPointsBalanceHandler,
  GetLeaderboardHandler,
];

@Module({
  imports: [CqrsModule],
  controllers: [GamificationController],
  providers: handlers,
})
export class GamificationModule {}
