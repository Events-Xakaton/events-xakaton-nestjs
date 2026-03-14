import {
  Global,
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';

import { HttpMetricsMiddleware } from './http-metrics.middleware';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

/**
 * Глобальный модуль наблюдаемости.
 * Предоставляет MetricsService всему приложению (Prometheus метрики).
 * Регистрирует HttpMetricsMiddleware для измерения латентности всех HTTP-запросов.
 */
@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(HttpMetricsMiddleware)
      .forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
