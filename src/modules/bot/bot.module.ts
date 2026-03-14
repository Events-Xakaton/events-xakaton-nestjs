import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';

import {
  AppConfigModule,
  AppConfigService,
  EnvVariableName,
} from '@shared/config';

import { BotUpdate } from './bot.update';

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
  providers: [BotUpdate],
})
export class BotModule {}
