import { Inject, Injectable, Logger } from '@nestjs/common';

import { ReddyHttpClient } from './reddy-http.client';

export interface ReddyUserInfo {
  id: string;
  userKey: string;
}

interface ReddyFindUserResponse {
  user?: {
    id?: string;
  };
}

interface FindUserOptions {
  timeoutMs?: number;
  disableRetries?: boolean;
}

/**
 * Высокоуровневый клиент для Reddy BotAPI.
 * Оборачивает ReddyHttpClient и предоставляет типизированные методы.
 */
@Injectable()
export class ReddyClient {
  private readonly logger = new Logger(ReddyClient.name);

  constructor(
    @Inject(ReddyHttpClient) private readonly httpClient: ReddyHttpClient,
  ) {}

  /**
   * Поиск пользователя Reddy по userKey.
   *
   * @param options.timeoutMs - timeout для запроса (600мс по умолчанию в AuthService для быстрого fallback)
   * @param options.disableRetries - отключить retry для этого запроса
   */
  async findUser(
    userKey: string,
    options?: FindUserOptions,
  ): Promise<ReddyUserInfo> {
    if (this.httpClient.mockMode) {
      this.logger.warn(
        'Reddy credentials are not configured, using mock findUser',
      );
      return {
        id: `mock-${userKey}`,
        userKey,
      };
    }

    try {
      const data = await this.httpClient.get<ReddyFindUserResponse>(
        `/finduser?userkey=${encodeURIComponent(userKey)}`,
        'find_user',
        options,
      );

      if (!data.user?.id) {
        throw new Error('Reddy findUser returned invalid user payload');
      }

      return {
        id: String(data.user.id),
        userKey,
      };
    } catch (error) {
      this.logger.error(`Failed to find Reddy user: ${String(error)}`);
      throw error;
    }
  }
}
