# Спека: Система уровней и рангов

## Контекст

Очки уже считаются через append-only `PointsLedger`. Поле `lifetime` в `PointsBalanceResDto` — готовая основа для вычисления ранга. **Новых таблиц не нужно** — ранг вычисляется на лету по сумме всех `deltaPoints` пользователя.

---

## 1. Ранги (10 уровней)

Названия — актуальные мемы 2024–2025. Прогрессия от нормиса до смешарика.

| Уровень | Название | Порог (lifetime pts) | Мем-источник |
|---|---|---|---|
| 1 | Нормис | 0 | «Normie» — тот, кто ещё не в теме; противопоставление олду |
| 2 | Скуф | 15 | Мем 2024 о расслабленном мужике на диване |
| 3 | Краш | 40 | Сленг 2024–2025 — человек, который нравится всем |
| 4 | Чиназес | 90 | Вирусный сленг 2024 — «всё хорошо и круто» |
| 5 | Бобёр | 170 | Вирусная песня SLAVA SKRIPKA, мем-символ добра 2025 |
| 6 | Окак | 290 | Мем 2025 — чёрный кот в худи с неожиданной реакцией |
| 7 | Войд | 450 | «Void» — тёмная эстетика, человек глубоко в интернете |
| 8 | Брейнрот | 660 | Brain rot 2025 — мозг полностью съеден интернетом |
| 9 | Бомбардиро | 940 | Бомбардиро Крокодило — итальянский брейнрот, покоривший рунет |
| 10 | Смешарик | 1300 | «Я уже смешарик» — финальная форма |

**Правило вычисления:** наибольший уровень, чей `minPoints` ≤ `lifetimePoints`.
**Понижение невозможно** — ранг зависит только от накопленной суммы очков.

**Формат отображения:** `«Ур. N · Название»`, например `«Ур. 7 · Альтушка»`.

---

## 2. Правила начисления очков

### Существующие (не меняются)

| ruleCode | Очки |
|---|---|
| `club_create` | +10 |
| `event_create` | +8 |
| `club_join` | +3 |
| `event_join` | +1 |
| `attendance_feedback` | +4 |
| `club_new_member_bonus` | +1 |

### Новые

| Действие | ruleCode | Очки | Однократно? | referenceId |
|---|---|---|---|---|
| Написать комментарий | `comment_create` | +1 | Нет | `comment_${commentId}` |
| Получить подписчика | `follower_gained` | +2 | Нет | `follower_gained_${followerId}_${followedId}` |
| Первое участие в событии | `first_event_join` | +5 | Да | `first_event_join_${userId}` |
| Заполнить профиль (добавить аватар) | `profile_complete` | +5 | Да | `profile_complete_${userId}` |

> Идемпотентность «однократных» правил обеспечивается фиксированным `referenceId` — `PointsService.award` проигнорирует повторный вызов автоматически.

**Пример прокачки нового пользователя:**
Вступил в клуб (+3) → сходил на первое событие (+1 +5) → подтвердил посещение (+4) → написал 3 комментария (+3) → добавил аватар (+5) = **21 очко → Ур. 3 · Ничоси**.

---

## 3. Структура `RankInfo`

```typescript
// src/shared/constants/ranks.constants.ts
export const RANKS = [
  { level: 1,  title: 'Нормис',     minPoints: 0    },
  { level: 2,  title: 'Скуф',       minPoints: 15   },
  { level: 3,  title: 'Краш',       minPoints: 40   },
  { level: 4,  title: 'Чиназес',    minPoints: 90   },
  { level: 5,  title: 'Бобёр',      minPoints: 170  },
  { level: 6,  title: 'Окак',       minPoints: 290  },
  { level: 7,  title: 'Войд',       minPoints: 450  },
  { level: 8,  title: 'Брейнрот',   minPoints: 660  },
  { level: 9,  title: 'Бомбардиро', minPoints: 940  },
  { level: 10, title: 'Смешарик',   minPoints: 1300 },
] as const;
```

```typescript
// src/shared/utils/compute-rank.ts
export function computeRank(lifetimePoints: number): {
  level: number;
  title: string;
  pointsToNextLevel: number | null; // null на 10-м уровне
}
```

---

## 4. Где отображается ранг

Ранг добавляется во все DTO, где фигурирует информация о пользователе:

| Endpoint | DTO | Изменение |
|---|---|---|
| `GET /points/balance` | `PointsBalanceResDto` | + поле `rank: RankInfoDto` |
| `GET /leaderboard` | `LeaderboardEntryResDto` | переименовать `rank` → `position`; + поле `rankInfo: RankInfoDto` |
| `GET /clubs/:id/members` | запись участника | + поле `rankInfo: RankInfoDto` |
| `GET /events/:id/participants` | запись участника | + поле `rankInfo: RankInfoDto` |
| `GET /users/:id` (профиль) | профиль пользователя | + поле `rankInfo: RankInfoDto` |
| `GET /connections/followers`, `/following` | запись подписки | + поле `rankInfo: RankInfoDto` |

> **Breaking change в leaderboard:** `LeaderboardEntryResDto.rank` (порядковая позиция) → `position`. Поле `rank` теперь занято под `RankInfoDto`. Фронтенд нужно уведомить.

### DTO

```typescript
// src/modules/gamification/dto/response/rank-info.res.dto.ts
export class RankInfoDto {
  declare level: number;             // 1–10
  declare title: string;             // «Смешарик»
  declare label: string;             // «Ур. 10 · Смешарик»
  declare pointsToNextLevel: number | null;
}
```

---

## 5. Производительность (списочные запросы)

Для club members (до 300 чел.) и event participants (до 300 чел.) ранг нельзя считать по одному запросу на пользователя — нужен батч:

```typescript
// Один groupBy-запрос для всех userId сразу
const rows = await prisma.pointsLedger.groupBy({
  by: ['userId'],
  _sum: { deltaPoints: true },
  where: { userId: { in: userIds } },
});
const pointsMap = new Map(rows.map(r => [r.userId, r._sum.deltaPoints ?? 0]));

// computeRank() вызывается in-memory для каждой записи
members.map(m => ({ ...m, rankInfo: computeRank(pointsMap.get(m.userId) ?? 0) }));
```

---

## 6. Что нужно создать / изменить

### Новые файлы
```
src/shared/constants/ranks.constants.ts
src/shared/utils/compute-rank.ts
src/modules/gamification/dto/response/rank-info.res.dto.ts
```

### Изменяемые файлы
```
src/shared/constants/points.constants.ts
  + COMMENT_CREATE: 1
  + FOLLOWER_GAINED: 2
  + FIRST_EVENT_JOIN: 5
  + PROFILE_COMPLETE: 5

src/modules/gamification/dto/response/
  leaderboard.res.dto.ts        — rank → position, + rankInfo: RankInfoDto
  points-balance.res.dto.ts     — + rank: RankInfoDto

src/modules/gamification/handlers/
  get-points-rules.handler.ts   — добавить 4 новых правила
  get-leaderboard.handler.ts    — + lifetime groupBy, + computeRank на каждую запись
  get-points-balance.handler.ts — + computeRank(lifetime)

src/modules/comments/handlers/create-comment.handler.ts
  → pointsService.award({ ruleCode: 'comment_create', ... })

src/modules/connections/handlers/follow-user.handler.ts
  → pointsService.award для followedUserId ({ ruleCode: 'follower_gained', ... })

src/modules/events/handlers/join-event.handler.ts
  → pointsService.award для first_event_join (после обычного event_join)

src/modules/auth/handlers/update-profile.handler.ts (или аналог)
  → pointsService.award при первом сохранении avatarUrl

+ handlers листинга участников клубов, событий, подписок
  → добавить pointsMap + computeRank
```

---

## 7. Out of scope

- Уведомление о повышении ранга
- Сброс ранга / сезонные ранги
- Администраторский override ранга
- Анимации, бейджи, иконки уровней (данные есть — рендер на фронте)
