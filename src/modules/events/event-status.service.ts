import { Injectable } from '@nestjs/common';

export type EventStatusCode = 'upcoming' | 'ongoing' | 'past' | 'cancelled';

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
  calculate(input: {
    status: string;
    startsAtUtc: Date;
    endsAtUtc: Date;
    now?: Date;
  }): EventStatusCode {
    if (input.status === 'cancelled') {
      return 'cancelled';
    }
    const now = input.now ?? new Date();
    if (now.getTime() < input.startsAtUtc.getTime()) {
      return 'upcoming';
    }
    if (now.getTime() < input.endsAtUtc.getTime()) {
      return 'ongoing';
    }
    return 'past';
  }
}
