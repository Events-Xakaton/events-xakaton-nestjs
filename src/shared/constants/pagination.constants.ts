/** Лимиты выборки из БД и пагинации. Все значения — максимально допустимые или дефолтные. */
export const PAGINATION = {
  CLUBS_LIST_LIMIT: 50,
  CLUB_MEMBERS_LIMIT: 300,
  CLUB_EVENTS_DEFAULT_LIMIT: 10,
  CLUB_EVENTS_MAX_LIMIT: 20,
  CLUB_AUTHORING_LIMIT: 200,

  EVENTS_LIST_LIMIT: 50,
  EVENT_PARTICIPANTS_LIMIT: 300,

  COMMENTS_LIST_LIMIT: 500,
  FOLLOWING_LIST_LIMIT: 200,

  LEADERBOARD_TOP_SIZE: 10,
  POINTS_HISTORY_LIMIT: 100,
  NOTIFICATIONS_DEFAULT_LIMIT: 20,

  /** Максимальное количество тегов для клуба или события */
  MAX_TAGS_PER_ENTITY: 3,
} as const;
