import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EnvVariableName } from './env.enum';

/**
 * Типизированная обёртка над NestJS ConfigService.
 * Принимает только ключи из EnvVariableName — исключает опечатки и магические строки.
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  /** Возвращает значение переменной окружения или undefined если не задана */
  get(key: EnvVariableName): string | undefined {
    return this.configService.get<string>(key);
  }

  /** Возвращает значение переменной окружения или бросает ошибку если не задана */
  getOrThrow(key: EnvVariableName): string {
    return this.configService.getOrThrow<string>(key);
  }
}
