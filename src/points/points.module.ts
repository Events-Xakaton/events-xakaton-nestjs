import { Global, Module } from '@nestjs/common';

import { PointsService } from './points.service';

/** Глобальный модуль — PointsService доступен в clubs, events и других модулях */
@Global()
@Module({
  providers: [PointsService],
  exports: [PointsService],
})
export class PointsModule {}
