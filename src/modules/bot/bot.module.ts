import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';

import {
  AppConfigModule,
  AppConfigService,
  EnvVariableName,
} from '@shared/config';

import { BotUpdate } from './bot.update';
import { TelegramNotificationService } from './telegram-notification.service';

@Module({
  imports: [
    TelegrafModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        token: config.getOrThrow(EnvVariableName.TELEGRAM_BOT_TOKEN),
      }),
    }),
  ],
  providers: [BotUpdate, TelegramNotificationService],
  exports: [TelegramNotificationService],
})
export class BotModule {}
