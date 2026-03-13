import { Controller, Get, Inject, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';

import { MetricsService } from './metrics.service';

@ApiTags('observability')
@Controller()
export class MetricsController {
  constructor(
    @Inject(MetricsService) private readonly metricsService: MetricsService,
  ) {}

  /**
   * Эндпоинт для Prometheus scrape.
   * Возвращает метрики в формате text/plain (exposition format).
   */
  @Get('metrics')
  @ApiOperation({ summary: 'Prometheus метрики' })
  @ApiResponse({
    status: 200,
    description: 'Метрики в Prometheus exposition format',
  })
  async metrics(@Res() res: Response): Promise<void> {
    const body = await this.metricsService.getMetrics();
    res.setHeader('Content-Type', this.metricsService.getContentType());
    res.status(200).send(body);
  }
}
