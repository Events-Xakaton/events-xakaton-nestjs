import { Module } from '@nestjs/common';

import { JobsModule } from '@jobs/jobs.module';

import { OtpSendWorker } from './otp-send.worker';
import { ReddyHttpClient } from './reddy-http.client';
import { ReddyClient } from './reddy.client';
import { ReddySendService } from './reddy.send.service';

@Module({
  imports: [JobsModule],
  providers: [ReddyHttpClient, ReddyClient, ReddySendService, OtpSendWorker],
  exports: [ReddyClient, ReddySendService],
})
export class ReddyModule {}
