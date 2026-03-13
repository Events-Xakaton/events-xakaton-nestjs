import { Inject, Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import IORedis, { Redis } from 'ioredis';

import { MetricsService } from '@observability/metrics.service';
import { AppConfigService, EnvVariableName } from '@shared/config';

/**
 * Обёртка над IORedis.
 * Отслеживает состояние подключения и отражает его в метриках Prometheus
 * (если ObservabilityModule подключён).
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(
    @Inject(AppConfigService)
    private readonly appConfigService: AppConfigService,
    @Optional()
    @Inject(MetricsService)
    private readonly metricsService?: MetricsService,
  ) {
    const redisUrl = this.appConfigService.get(EnvVariableName.REDIS_URL);
    this.client = new IORedis(redisUrl ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });

    this.metricsService?.setRedisConnected(false);
    this.client.on('ready', () => this.metricsService?.setRedisConnected(true));
    this.client.on('end', () => this.metricsService?.setRedisConnected(false));
    this.client.on('error', () =>
      this.metricsService?.setRedisConnected(false),
    );
  }

  /** Возвращает raw IORedis client для прямых команд */
  getClient(): Redis {
    return this.client;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
