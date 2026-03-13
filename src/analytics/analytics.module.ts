import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '@shared/prisma';

import { AnalyticsService } from './analytics.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
