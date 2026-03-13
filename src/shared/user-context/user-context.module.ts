import { Global, Module } from '@nestjs/common';

import { UserContextService } from './user-context.service';

/** Глобальный модуль — UserContextService доступен во всём приложении */
@Global()
@Module({
  providers: [UserContextService],
  exports: [UserContextService],
})
export class UserContextModule {}
