import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { AnalyticsModule } from '@analytics/analytics.module';
import { JobsModule } from '@jobs/jobs.module';
import { ReddyModule } from '@reddy/reddy.module';

import { AuthController } from './auth.controller';
import {
  RequestCodeHandler,
  ReverifyHandler,
  VerifyCodeHandler,
} from './handlers';
import { ReddyIdentityService } from './reddy-identity.service';
import { VerificationService } from './verification.service';

const handlers = [RequestCodeHandler, VerifyCodeHandler, ReverifyHandler];

@Module({
  imports: [CqrsModule, ReddyModule, JobsModule, AnalyticsModule],
  controllers: [AuthController],
  providers: [ReddyIdentityService, VerificationService, ...handlers],
})
export class AuthModule {}
