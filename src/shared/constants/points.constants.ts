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
  COMMENT_CREATE: 1,
  FOLLOWER_GAINED: 2,
  FIRST_EVENT_JOIN: 5,
  PROFILE_COMPLETE: 5,
} as const;
