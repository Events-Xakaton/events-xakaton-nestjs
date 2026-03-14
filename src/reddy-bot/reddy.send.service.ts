import { Inject, Injectable, Logger } from '@nestjs/common';

import { ReddyHttpClient } from './reddy-http.client';

interface ReddySendResponse {
  errorCode?: number;
  errorMessage?: string;
  messageId?: number;
}

/**
 * Сервис отправки сообщений через Reddy BotAPI.
 * Используется для OTP-кодов и уведомлений об изменении событий.
 */
@Injectable()
export class ReddySendService {
  private readonly logger = new Logger(ReddySendService.name);

  constructor(
    @Inject(ReddyHttpClient) private readonly httpClient: ReddyHttpClient,
  ) {}

  /**
   * Отправляет личное сообщение пользователю Reddy.
   *
   * @param userKey - идентификатор пользователя в Reddy
   * @param text - текст сообщения (поддерживает **markdown**)
   * @throws Error если errorCode != 0 в ответе API
   */
  async sendDirectMessage(userKey: string, text: string): Promise<void> {
    console.log(userKey);

    if (this.httpClient.mockMode) {
      this.logger.warn(
        `Reddy credentials are not configured, mock send to userKey=${userKey}`,
      );
      return;
    }

    try {
      const payload = await this.httpClient.post<ReddySendResponse>(
        '/send',
        {
          userKey,
          userkey: userKey, // Reddy API принимает оба варианта написания
          msg: text,
        },
        'send_message',
      );

      if ((payload.errorCode ?? 0) !== 0) {
        throw new Error(
          `Reddy send failed with errorCode=${payload.errorCode ?? 'unknown'} message=${
            payload.errorMessage ?? 'unknown'
          }`,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to send Reddy message: ${String(error)}`);
      throw error;
    }
  }
}
