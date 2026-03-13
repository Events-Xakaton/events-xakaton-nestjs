import { Global, Module } from '@nestjs/common';

import { RedisService } from './redis.service';

/** Глобальный модуль — RedisService доступен во всём приложении */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
