import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

import { MetricsService } from './metrics.service';

/**
 * Middleware для измерения латентности HTTP-запросов.
 * Записывает метрики в MetricsService после завершения ответа (событие finish).
 */
@Injectable()
export class HttpMetricsMiddleware implements NestMiddleware {
  constructor(
    @Inject(MetricsService) private readonly metricsService: MetricsService,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const startedAt = process.hrtime.bigint();
    res.on('finish', () => {
      const elapsedNs = Number(process.hrtime.bigint() - startedAt);
      const durationMs = elapsedNs / 1_000_000;
      this.metricsService.observeHttp({
        method: req.method,
        route: req.path || req.url,
        statusCode: res.statusCode,
        durationMs,
      });
    });
    next();
  }
}
