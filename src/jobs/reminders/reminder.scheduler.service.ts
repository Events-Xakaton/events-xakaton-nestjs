import { Inject, Injectable } from '@nestjs/common';

import { QueueService } from '../queue.service';

/**
 * Сервис для управления напоминаниями о начале событий.
 *
 * Напоминание отправляется за 2 часа до начала события.
 * При перепланировании (изменение времени события) старое напоминание заменяется новым.
 */
@Injectable()
export class ReminderSchedulerService {
  constructor(
    @Inject(QueueService) private readonly queueService: QueueService,
  ) {}

  /**
   * Планирует напоминание о начале события для конкретного участника.
   * Если напоминание уже существует — перезаписывает его (для случая изменения времени).
   *
   * @param params.startsAtUtc - время начала события; напоминание = startsAtUtc - 2ч
   */
  async scheduleStartReminder(params: {
    eventId: string;
    userId: string;
    eventTitle: string;
    startsAtUtc: Date;
  }): Promise<void> {
    const reminderTime = params.startsAtUtc.getTime() - 2 * 60 * 60 * 1000;
    const delayMs = Math.max(0, reminderTime - Date.now());
    const dedupKey = `reminder_${params.eventId}_${params.userId}`;

    // Удаляем старое напоминание перед установкой нового
    await this.queueService.removeByDedupKey('reminders', dedupKey);

    await this.queueService.enqueue(
      'reminders',
      {
        type: 'start-reminder',
        payload: {
          eventId: params.eventId,
          userId: params.userId,
          eventTitle: params.eventTitle,
          startsAtUtc: params.startsAtUtc.toISOString(),
        },
      },
      dedupKey,
      { delayMs },
    );
  }

  /**
   * Отменяет напоминание для участника.
   * Вызывается при выходе из события или отмене события.
   */
  async cancelStartReminder(eventId: string, userId: string): Promise<void> {
    const dedupKey = `reminder_${eventId}_${userId}`;
    await this.queueService.removeByDedupKey('reminders', dedupKey);
  }
}
