# Спека: Позиции в лидерборде

> Статус: актуальная.

---

## 1. Проблема

### 1.1 Баг: позиция «0» у текущего пользователя

Если у авторизованного пользователя нет очков за текущий период, бэкенд возвращает:

```json
{
  "currentUser": {
    "position": 0,
    "points": 0,
    ...
  }
}
```

Фронтенд трансформирует `position → rank` и отображает значок `"0"` — что некорректно.

### 1.2 Что должно быть

| Ситуация | `position` (бэкенд) | Отображение (фронтенд) |
|---|---|---|
| Пользователь в топ-10 | `1..10` | Цифра в значке (1, 2, 3…) |
| Пользователь вне топ-10, но есть очки | `11..N` | Цифра в значке (11, 42…) |
| Пользователь без очков за период | `null` | Прочерк `—` в значке |
| Пользователь не авторизован | `currentUser: null` | Блок не отображается |

---

## 2. Бэкенд

**Файл:** `src/modules/gamification/handlers/get-leaderboard.handler.ts`

**Изменение:** когда у пользователя нет записей в `pointsLedger` за период, возвращать `position: null`, а не `0`.

```typescript
// Было:
currentUserBase = {
  position: 0,
  ...
};

// Стало:
currentUserBase = {
  position: null,
  ...
};
```

**Файл:** `src/modules/gamification/dto/response/leaderboard.res.dto.ts`

```typescript
// Изменить тип поля position в LeaderboardEntryResDto:
@ApiProperty({
  nullable: true,
  description: 'Позиция в рейтинге. null — если нет очков за период',
})
declare position: number | null;
```

---

## 3. Фронтенд

### 3.1 `gamification-api.ts` — обновить типы

```typescript
// src/shared/api/gamification-api.ts

// В query-типе (то, что возвращает transformResponse):
top: Array<{
  rank: number;         // в топе всегда есть позиция
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  points: number;
  rankInfo?: RankInfo;
}>;
currentUser: {
  rank: number | null;  // null = нет очков за период
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  points: number;
  rankInfo?: RankInfo;
} | null;

// В raw-типе (то, что приходит с бэка):
top: Array<{
  position: number;
  ...
}>;
currentUser: {
  position: number | null;  // null вместо 0
  ...
} | null;
```

### 3.2 `PointsScreen` — обновить вспомогательные функции

```typescript
// src/views/points/index.tsx

// Было:
function rankBadge(rank: number): string {
  if (rank === 1) return '1';
  if (rank === 2) return '2';
  if (rank === 3) return '3';
  return String(rank);
}

// Стало:
function rankBadge(rank: number | null): string {
  if (rank === null) return '—';
  if (rank === 1) return '1';
  if (rank === 2) return '2';
  if (rank === 3) return '3';
  return String(rank);
}

// rankBadgeClass и rankRowClass — добавить обработку null:
function rankBadgeClass(rank: number | null, isCurrentUser: boolean): string {
  if (rank === null || rank > 3) {
    return isCurrentUser
      ? 'border-blue-300 bg-blue-100 text-blue-700'
      : 'border-zinc-200 bg-zinc-100 text-zinc-700';
  }
  // ... существующая логика для 1, 2, 3
}

function rankRowClass(rank: number | null, isCurrentUser: boolean): string {
  if (rank === null || rank > 3) {
    return isCurrentUser ? 'border-blue-300 bg-blue-50' : 'border-zinc-200 bg-white';
  }
  // ... существующая логика для 1, 2, 3
}
```

### 3.3 `PointsScreen` — блок текущего пользователя вне топа

Блок «текущий пользователь ниже топа» должен отображаться в двух случаях:
1. Пользователь не в топ-10, но есть очки → показывает позицию (например, «42»)
2. Пользователь не в топ-10, очков нет → показывает «—» и `0` очков

**Текущее условие остаётся:** `{!inTopTen && current}`

Изменение только в рендеринге значка позиции:
```tsx
<span className={...}>
  {rankBadge(current.rank)}  {/* null → '—' */}
</span>
```

---

## 4. Сценарии

| Сценарий | Бэкенд | Фронтенд |
|---|---|---|
| Топ-10, позиция 1 | `position: 1` | Золотой значок «1», Trophy-иконка |
| Топ-10, позиция 5 | `position: 5` | Серый значок «5» |
| Вне топа, позиция 42 | `position: 42` | Синяя карточка, значок «42», `"..."` выше |
| Нет очков за период | `position: null` | Синяя карточка, значок «—», `"..."` выше, очки `0` |
| Не авторизован | `currentUser: null` | Блок не рендерится |

---

## 5. Что не меняется

- `inTopTen` определяется по совпадению `userId` — логика остаётся
- Сортировка в топе: по убыванию очков → имя → UUID — не меняется
- Лайфтайм очки для `rankInfo` — не меняются
- `"..."` разделитель между топом и текущим пользователем — остаётся при `!inTopTen && current`
