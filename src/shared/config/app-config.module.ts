import { Global, Module } from '@nestjs/common';

import { AppConfigService } from './app-config.service';

/**
 * Глобальный модуль — AppConfigService доступен во всём приложении без явного импорта.
 * Регистрируется один раз в AppModule.
 */
@Global()
@Module({
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
