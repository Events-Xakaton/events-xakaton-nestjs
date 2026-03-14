import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { AnalyticsModule } from '@analytics/analytics.module';
import { HealthModule } from '@health/health.module';
import { JobsModule } from '@jobs/jobs.module';
import { AdminModule } from '@modules/admin';
import { AuthModule } from '@modules/auth';
import { ClubsModule } from '@modules/clubs';
import { CommentsModule } from '@modules/comments/';
import { ConnectionsModule } from '@modules/connections';
import { EventsModule } from '@modules/events';
import { GamificationModule } from '@modules/gamification';
import { NotificationsModule } from '@modules/notifications';
import { ObservabilityModule } from '@observability/observability.module';
import { PointsModule } from '@points/points.module';
import { ReddyModule } from '@reddy/reddy.module';
import { RbacGuard, TelegramInitDataMiddleware } from '@shared/auth';
import {
  AppConfigModule,
  AppConfigService,
  EnvVariableName,
} from '@shared/config';
import { GeneralExceptionFilter } from '@shared/filters';
import { IdempotencyMiddleware } from '@shared/idempotency';
import { RequestContextMiddleware } from '@shared/observability';
import { PrismaModule } from '@shared/prisma';
import { AppThrottlerGuard } from '@shared/rate-limit';
import { RedisModule } from '@shared/redis';
import { UserContextModule } from '@shared/user-context';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),
    AppConfigModule,
    LoggerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        pinoHttp: {
          level: config.get(EnvVariableName.LOG_LEVEL) ?? 'info',
          // pino-pretty для разработки; в продакшене — структурированный JSON
          transport:
            config.get(EnvVariableName.NODE_ENV) !== 'production'
              ? {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    singleLine: false,
                    translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
                    ignore: 'pid,hostname',
                  },
                }
              : undefined,
          // Скрываем Telegram auth-данные и токены из HTTP-логов
          redact: [
            'req.headers["x-telegram-init-data"]',
            'req.headers["x-telegram-user-id"]',
            'req.headers.authorization',
            'req.headers.cookie',
          ],
        },
      }),
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    PrismaModule,
    RedisModule,
    UserContextModule,
    PointsModule,
    JobsModule,
    ReddyModule,
    AnalyticsModule,
    AuthModule,
    ClubsModule,
    CommentsModule,
    ConnectionsModule,
    EventsModule,
    GamificationModule,
    ObservabilityModule,
    NotificationsModule,
    AdminModule,
    HealthModule,
  ],
  providers: [
    // Фильтр зарегистрирован через DI (не через useGlobalFilters) —
    // только так PinoLogger может быть инжектирован в него
    {
      provide: APP_FILTER,
      useClass: GeneralExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RbacGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(
        RequestContextMiddleware,
        TelegramInitDataMiddleware,
        IdempotencyMiddleware,
      )
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
