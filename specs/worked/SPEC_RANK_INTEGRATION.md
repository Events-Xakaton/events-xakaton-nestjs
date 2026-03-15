# Спека: интеграция рангов и уровней на страницах приложения

## Контекст

Все перечисленные ниже API-эндпоинты уже возвращают поле `rankInfo` для каждого пользователя.
Задача фронтенда — показывать эту информацию в UI там, где появляется карточка/строка пользователя.

Тип `RankInfo` одинаков везде:

```typescript
interface RankInfo {
  level:             number;        // 1–10
  title:             string;        // "Новичок" … "Гуру"
  label:             string;        // "Ур. 3 · Участник"
  pointsToNextLevel: number | null; // null на уровне 10
}
```

---

## Переиспользуемый компонент `RankBadge`

Единственный shared-компонент для отображения ранга. Используется на всех страницах ниже.

```
shared/ui/rank-badge/
  RankBadge.tsx
  index.ts
```

### Props

```typescript
interface RankBadgeProps {
  rankInfo: RankInfo;
  /**
   * "inline"  — однострочный чип: «Ур. 3 · Участник»
   *             используется в списках (участники, члены, подписки)
   * "full"    — чип + мини прогресс-бар (только если известны lifetime-очки)
   *             используется в лидерборде рядом с очками за период
   */
  variant?: 'inline' | 'full';
  lifetimePoints?: number; // обязателен при variant="full"
  className?: string;
}
```

### Внешний вид

**`inline`** (по умолчанию):
```
┌──────────────────┐
│ ★ Ур. 3 · Участник │   ← маленький чип, rounded-full, bg-indigo-50 text-indigo-700
└──────────────────┘
```

**`full`**:
```
┌─────────────────────────────┐
│ ★ Ур. 3 · Участник          │
│ ████████░░░░░░  22 / 50 оч. │
└─────────────────────────────┘
```

Прогресс-бар в варианте `full` использует ту же логику, что описана в `SPEC_HEADER_RANK.md`:
- статическая таблица `RANKS` на фронте
- `progress = (lifetimePoints - currentRank.minPoints) / (nextRank.minPoints - currentRank.minPoints)`
- на уровне 10: полная полоса + текст «MAX»

---

## 1. Страница лидерборда

### API

```
GET /leaderboard?period=weekly|monthly
Headers: x-telegram-init-data
```

### Ответ

```typescript
interface LeaderboardResponse {
  period: 'weekly' | 'monthly';
  top: LeaderboardEntry[];
  currentUser: LeaderboardEntry | null; // позиция текущего пользователя
}

interface LeaderboardEntry {
  position:  number;    // порядковый номер в рейтинге (1, 2, 3…)
  userId:    string;
  fullName:  string;
  points:    number;    // очки ЗА ПЕРИОД (weekly/monthly), не lifetime
  rankInfo:  RankInfo;  // ранг по lifetime-очкам
}
```

### Макет строки лидерборда

```
┌──────────────────────────────────────────────────────────────────┐
│  #1   [Аватар]  Иван Петров                  1 240 оч. за неделю │
│                 ★ Ур. 7 · Коннектор                              │
├──────────────────────────────────────────────────────────────────┤
│  #2   [Аватар]  Мария Сидорова                 980 оч. за неделю │
│                 ★ Ур. 6 · Организатор                            │
├──────────────────────────────────────────────────────────────────┤
│  ...                                                             │
├──────────────────────────────────────────────────────────────────┤
│  ── Ваша позиция ──────────────────────────────────────────────  │
│  #14  [Аватар]  Вы                               42 оч. за неделю│
│                 ★ Ур. 3 · Участник                               │
└──────────────────────────────────────────────────────────────────┘
```

### Требования

- `position` отображать как `#N` перед аватаром; топ-3 выделить золотом/серебром/бронзой.
- `points` — очки **за выбранный период** (недель/месяц), подпись рядом.
- `rankInfo` — использовать `<RankBadge variant="inline" rankInfo={entry.rankInfo} />` под именем.
- `currentUser` — если не null и отсутствует в `top` (позиция > длины `top`), показать отдельной секцией «Ваша позиция» с разделителем под списком. Если `currentUser` входит в `top` — выделить строку фоном.
- Переключатель периода `weekly` / `monthly` — таб или сегментированная кнопка вверху. При переключении — рефетч.

---

## 2. Страница участников события

### API

```
GET /events/:eventId/participants
Headers: x-telegram-init-data
```

### Ответ

```typescript
interface EventParticipant {
  telegramUserId: string;
  fullName:       string;
  avatarUrl:      string | null;
  followedByMe:   boolean;  // подписан ли текущий пользователь на этого участника
  rankInfo:       RankInfo;
}
```

### Макет строки участника

```
┌─────────────────────────────────────────────────────┐
│  [Аватар]  Иван Петров              [Подписаться ▷]  │
│            ★ Ур. 5 · Завсегдатай                    │
└─────────────────────────────────────────────────────┘
```

### Требования

- `rankInfo` — `<RankBadge variant="inline" />` под именем.
- `followedByMe` определяет состояние кнопки «Подписаться» / «Отписаться».
- Аватар: если `avatarUrl === null` — показать круглую заглушку с инициалом.

---

## 3. Страница членов клуба

### API

```
GET /clubs/:clubId/members
Headers: x-telegram-init-data
```

### Ответ

```typescript
interface ClubMember {
  telegramUserId: string;
  fullName:       string;
  avatarUrl:      string | null;
  followedByMe:   boolean;
  role?:          'owner' | 'admin' | 'event_manager' | 'member'; // опционально
  rankInfo:       RankInfo;
}
```

### Макет строки члена клуба

```
┌────────────────────────────────────────────────────────────────┐
│  [Аватар]  Мария Сидорова         [Владелец]  [Подписаться ▷]  │
│            ★ Ур. 6 · Организатор                               │
└────────────────────────────────────────────────────────────────┘
```

### Требования

- `rankInfo` — `<RankBadge variant="inline" />` под именем.
- `role` — если присутствует, показать роль в виде чипа справа от имени:
  - `owner` → «Владелец» (gold)
  - `admin` → «Админ» (blue)
  - `event_manager` → «Организатор» (green)
  - `member` → не показывать (роль по умолчанию)
- `followedByMe` — кнопка «Подписаться» / «Отписаться».

---

## 4. Страница подписок (following)

### API

```
GET /connections
Headers: x-telegram-init-data
```

### Ответ

```typescript
interface FollowingItem {
  telegramUserId: string;
  fullName:       string;
  followedAt:     string; // ISO 8601
  rankInfo:       RankInfo;
}
```

### Макет строки подписки

```
┌──────────────────────────────────────────────────────┐
│  [Аватар]  Иван Петров          подписан 12 мар 2025  │
│            ★ Ур. 4 · Тусовщик                        │
└──────────────────────────────────────────────────────┘
```

### Требования

- `rankInfo` — `<RankBadge variant="inline" />` под именем.
- `followedAt` — отображать как относительную дату («3 дня назад») или короткую («12 мар»), в зависимости от давности.
- Аватар: заглушка с инициалом (API не возвращает `avatarUrl` для этого эндпоинта).

---

## Размещение в FSD

```
shared/
  ui/
    rank-badge/
      RankBadge.tsx          # переиспользуемый компонент (inline + full)
      index.ts
  constants/
    ranks.ts                 # статическая таблица RANKS (нужна для full-варианта)
  api/
    gamification.api.ts      # RTK Query: getPointsBalance, getLeaderboard
    clubs.api.ts             # RTK Query: getClubMembers
    events.api.ts            # RTK Query: getEventParticipants
    connections.api.ts       # RTK Query: getFollowing

pages/
  leaderboard/               # страница лидерборда
  clubs/[clubId]/members/    # участники клуба
  events/[eventId]/participants/  # участники события
  connections/               # мои подписки
```

---

## Общие правила отображения ранга

| Контекст | Вариант `RankBadge` | Что показывать |
|---|---|---|
| Шапка приложения (своя) | `full` + прогресс-бар | `label` + прогресс-бар + `Х / Y оч.` |
| Лидерборд | `inline` | `label` |
| Участники события | `inline` | `label` |
| Члены клуба | `inline` | `label` |
| Подписки | `inline` | `label` |

Прогресс-бар (`full`) используется **только** в шапке (где есть `lifetimePoints` из `GET /points/balance`).
В списках других пользователей прогресс-бар **не показывается** — у нас нет их lifetime-очков.

---

## Скелетоны и загрузка

Все списки при загрузке показывают N скелетон-строк (3–5 штук):
- серый круг вместо аватара
- серый прямоугольник вместо имени (ширина ~60%)
- серый маленький прямоугольник вместо чипа ранга (ширина ~40%)
- всё с `animate-pulse`
