import { HttpStatus, Injectable } from '@nestjs/common';

import { EventStatus } from '@shared/domain';
import { AppException } from '@shared/exceptions';

/** @deprecated Используй EventStatus enum напрямую */
export type EventStatusCode = EventStatus;

/**
 * Вычисляет эффективный статус события на основе временных меток.
 *
 * Статус "cancelled" в БД имеет приоритет над временными вычислениями.
 * Остальные статусы определяются относительно текущего времени (UTC).
 */
@Injectable()
export class EventStatusService {
  /**
   * @param input.status — статус из БД ("upcoming", "ongoing", "past", "cancelled")
   * @param input.startsAtUtc — дата начала события
   * @param input.endsAtUtc — дата окончания события
   * @param input.now — текущее время (для тестов; по умолчанию new Date())
   */
  /**
   * Выбрасывает исключение если время окончания не позже времени начала.
   * Переиспользуется в CreateEventHandler и UpdateEventHandler.
   */
  assertEndsAfterStarts(startsAt: Date, endsAt: Date): void {
    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new AppException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Время окончания события должно быть позже начала',
      });
    }
  }

  calculate(input: {
    status: string;
    startsAtUtc: Date;
    endsAtUtc: Date;
    now?: Date;
  }): EventStatus {
    if ((input.status as EventStatus) === EventStatus.Cancelled) {
      return EventStatus.Cancelled;
    }
    const now = input.now ?? new Date();
    if (now.getTime() < input.startsAtUtc.getTime()) {
      return EventStatus.Upcoming;
    }
    if (now.getTime() < input.endsAtUtc.getTime()) {
      return EventStatus.Ongoing;
    }
    return EventStatus.Past;
  }
}
