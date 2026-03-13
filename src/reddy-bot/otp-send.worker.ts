import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Worker } from 'bullmq';

import { OtpSendJobPayload } from '@jobs/queue.types';
import { BaseWorker } from '@jobs/workers';

import { ReddySendService } from './reddy.send.service';

/**
 * Worker для отправки OTP-кодов через Reddy.
 *
 * Задачи в очередь otp-send добавляются из AuthService при запросе кода.
 * OTP-код передаётся в payload уже в виде готового текста сообщения.
 *
 * ВАЖНО: OTP-код никогда не логируется — только userKey получателя.
 */
@Injectable()
export class OtpSendWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OtpSendWorker.name);
  private worker?: Worker;

  constructor(
    @Inject(BaseWorker) private readonly baseWorker: BaseWorker,
    @Inject(ReddySendService)
    private readonly reddySendService: ReddySendService,
  ) {}

  onModuleInit(): void {
    this.worker = this.baseWorker.create<OtpSendJobPayload['payload']>(
      'otp-send',
      async ({ reddyUserKey, message }) => {
        if (!reddyUserKey || !message) {
          this.logger.warn('Invalid OTP payload received');
          return;
        }
        await this.reddySendService.sendDirectMessage(reddyUserKey, message);
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      try {
        await this.worker.close();
      } catch {
        // Игнорируем ошибки при закрытии в процессе остановки
      }
    }
  }
}
