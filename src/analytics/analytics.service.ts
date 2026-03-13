import { Inject, Injectable, Logger } from '@nestjs/common';
import { EntityType, EventStatus, Prisma, RoleCode } from '@prisma/client';
import { Request } from 'express';

import { AppConfigService, EnvVariableName } from '@shared/config';
import { PrismaService } from '@shared/prisma';

export interface TrackEventInput {
  eventName: string;
  req?: Request;
  userId?: string | null;
  entityType?: EntityType;
  entityId?: string;
  category?: string;
  eventStatus?: EventStatus;
  roleCode?: RoleCode;
  context?: Record<string, unknown>;
}

/**
 * Сервис для записи аналитических событий в БД.
 *
 * Все вызовы track() — fire-and-forget (не влияют на основной flow).
 * Ошибки записи логируются как warn, не пробрасываются наружу.
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @Inject(PrismaService) private readonly prismaService: PrismaService,
    @Inject(AppConfigService)
    private readonly appConfigService: AppConfigService,
  ) {}

  /**
   * Записывает аналитическое событие.
   * Вызывать через void (не await) — не блокирует основной запрос.
   */
  async track(input: TrackEventInput): Promise<void> {
    try {
      await this.prismaService.analyticsEvent.create({
        data: {
          eventName: input.eventName,
          userId: input.userId ?? null,
          entityType: input.entityType,
          entityId: input.entityId,
          category: input.category,
          eventStatus: input.eventStatus,
          roleCode: input.roleCode,
          endpoint:
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- точно знаем, что является строкой
            (input.req?.route?.path as string | undefined) ?? input.req?.path,
          clientVersion:
            typeof input.req?.header('x-client-version') === 'string'
              ? input.req?.header('x-client-version')
              : undefined,
          environment:
            this.appConfigService.get(EnvVariableName.NODE_ENV) ??
            'development',
          contextJson: input.context as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to persist analytics event ${input.eventName}: ${(error as Error).message}`,
      );
    }
  }
}
