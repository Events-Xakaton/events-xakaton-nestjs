import { Injectable, Logger } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';

/**
 * Инфраструктурный сервис для отправки сообщений в Telegram-бот.
 * Используется другими модулями для уведомлений пользователей.
 * Все вызовы — fire-and-forget (не бросают исключений наружу).
 */
@Injectable()
export class TelegramNotificationService {
  private readonly logger = new Logger(TelegramNotificationService.name);

  constructor(@InjectBot() private readonly bot: Telegraf) {}

  async sendMessage(telegramUserId: bigint, text: string): Promise<void> {
    try {
      await this.bot.telegram.sendMessage(Number(telegramUserId), text, {
        parse_mode: 'HTML',
      });
    } catch (error) {
      this.logger.warn(
        { telegramUserId: telegramUserId.toString(), error },
        'Не удалось отправить уведомление в Telegram',
      );
    }
  }
}
