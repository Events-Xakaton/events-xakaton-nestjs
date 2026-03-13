import { Global, Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { MetricsService } from '../../observability/metrics.service';
import { PrismaService } from './prisma.service';

/**
 * Глобальный модуль — PrismaService доступен во всём приложении без явного импорта.
 *
 * Инстанцирует PrismaClient с $extends для перехвата всех запросов к БД
 * и сбора метрик (модель, операция, длительность, результат).
 * Если ObservabilityModule не загружен, MetricsService не инжектируется
 * и PrismaClient создаётся без расширения.
 */
@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useFactory: async (
        metricsService?: MetricsService,
      ): Promise<PrismaService> => {
        const client = metricsService
          ? new PrismaClient().$extends({
              query: {
                $allModels: {
                  async $allOperations({ model, operation, args, query }) {
                    const startedAt = process.hrtime.bigint();
                    try {
                      const result = await query(args);
                      const durationMs =
                        Number(process.hrtime.bigint() - startedAt) / 1_000_000;
                      metricsService.observeDbQuery({
                        model: model ?? 'raw',
                        action: operation,
                        durationMs,
                        outcome: 'success',
                      });
                      return result;
                    } catch (error) {
                      const durationMs =
                        Number(process.hrtime.bigint() - startedAt) / 1_000_000;
                      metricsService.observeDbQuery({
                        model: model ?? 'raw',
                        action: operation,
                        durationMs,
                        outcome: 'error',
                      });
                      throw error;
                    }
                  },
                },
              },
            })
          : new PrismaClient();

        await client.$connect();
        return client as unknown as PrismaService;
      },
      inject: [{ token: MetricsService, optional: true }],
    },
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
