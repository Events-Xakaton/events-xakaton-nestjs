/**
 * Таблица начисления очков геймификации — единственный источник правды.
 * Используется в хендлерах начисления и в GetPointsRulesHandler для документации API.
 */
export const POINTS = {
  CLUB_CREATE: 10,
  EVENT_CREATE: 8,
  CLUB_JOIN: 3,
  EVENT_JOIN: 1,
  ATTENDANCE_FEEDBACK: 4,
  CLUB_NEW_MEMBER_BONUS: 1,
} as const;
