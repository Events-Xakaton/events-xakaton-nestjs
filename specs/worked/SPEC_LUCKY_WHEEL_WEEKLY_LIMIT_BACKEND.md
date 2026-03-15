# Спека (бэкенд): недельный лимит на стандартный спин Lucky Wheel

**Папка:** `specs/`
**Статус:** Draft
**Зависит от:** 001-lucky-wheel (реализован), `SPEC_LOGIN_STREAK_FREE_SPIN_BACKEND.md` (реализован)

---

## Суть задачи

Стандартный (бесплатный) спин Lucky Wheel разрешается **один раз в неделю**, а не один раз в день.
Дополнительные спины — только за счёт фри-спинов с баланса, которые зарабатываются серией входов.
Это усиливает мотивацию заходить в приложение каждый день: серия входов = накопление фри-спинов =
возможность крутить колесо чаще.

---

## Концептуальные изменения

### Было → стало

| Параметр | Было | Стало |
|---|---|---|
| Ключ ограничения | `dayKey` = "YYYY-MM-DD" (UTC) | `weekKey` = "YYYY-MM-DD" даты понедельника текущей недели (UTC) |
| Лимит | 1 стандартный спин в сутки | 1 стандартный спин в неделю |
| Фри-спин | работает поверх дневного лимита | работает поверх недельного лимита |

### Что НЕ меняется

- Логика фри-спинов: баланс, декремент, `FreeSpinGrant`, `FreeSpinBalance` — без изменений.
- Алгоритм выбора случайного события (окно K=5 ближайших) — без изменений.
- Lucky Wheel bypass для ценза уровня в `JoinEventHandler` — логика та же, только ключ обновляется.

---

## 1. Вычисление `weekKey`

`weekKey` — ISO-строка "YYYY-MM-DD" даты ближайшего прошедшего понедельника по UTC.
Примеры: воскресенье 2026-03-15 → `weekKey = "2026-03-09"` (пн той же недели).

Утилита `src/shared/utils/week-key.ts`:

```typescript
/**
 * Возвращает "YYYY-MM-DD" UTC-понедельника текущей недели.
 * Используется как ключ недельного лимита Lucky Wheel.
 */
export function getWeekKey(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getUTCDay();                    // 0=вс, 1=пн ... 6=сб
  const diff = day === 0 ? -6 : 1 - day;        // сдвиг до пн: вс→-6, сб→-5 ...
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}
```

---

## 2. Изменения схемы БД

### Модель `LuckyWheelUsage`

Переименовать поле `dayKey` → `weekKey` и обновить уникальный индекс:

```prisma
// БЫЛО:
model LuckyWheelUsage {
  id        String   @id @default(uuid())
  userId    String
  dayKey    String
  usedAtUtc DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, dayKey])
  @@index([userId])
}

// СТАЛО:
model LuckyWheelUsage {
  id        String   @id @default(uuid())
  userId    String
  weekKey   String                          // "YYYY-MM-DD" UTC-понедельника недели
  usedAtUtc DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, weekKey])
  @@index([userId])
}
```

### Миграция

```bash
npm run prisma:migrate -- --name lucky_wheel_weekly_limit
npm run prisma:generate
```

Prisma сгенерирует миграцию с `renameColumn dayKey → weekKey` (или `dropColumn` + `addColumn` —
в любом случае существующие dev-данные `LuckyWheelUsage` можно очистить: они тестовые).

---

## 3. Изменения в `GetRandomEventHandler`

### Все вхождения `dayKey` → `weekKey`, утилита `getWeekKey`

```typescript
// БЫЛО:
const dayKey = new Date().toISOString().slice(0, 10);
const existingUsage = await this.prisma.luckyWheelUsage.findUnique({
  where: { userId_dayKey: { userId: user.id, dayKey } },
});
// ...
await this.prisma.luckyWheelUsage.create({ data: { userId: user.id, dayKey } });

// СТАЛО:
import { getWeekKey } from '@shared/utils/week-key';

const weekKey = getWeekKey();
const existingUsage = await this.prisma.luckyWheelUsage.findUnique({
  where: { userId_weekKey: { userId: user.id, weekKey } },
});
// ...
await this.prisma.luckyWheelUsage.create({ data: { userId: user.id, weekKey } });
```

Логика фри-спинов остаётся идентичной — изменяется только ключ проверки.

### Аналитика

В `context` трекинга `event.random_open` заменить `dayKey → weekKey`:

```typescript
void this.analyticsService.track({
  eventName: 'event.random_open',
  userId: user.id,
  entityType: 'event',
  entityId: pick.id,
  context: { candidatesCount: eligible.length, windowSize: nearestWindow.length, usedFreeSpin, weekKey },
});
```

---

## 4. Изменения в `JoinEventHandler` (lucky bypass)

Lucky bypass проверяет, использовал ли пользователь колесо **на этой неделе** (не сегодня):

```typescript
// БЫЛО:
const isLuckyBypass =
  command.lucky &&
  (await this.prisma.luckyWheelUsage.findUnique({
    where: {
      userId_dayKey: {
        userId: user.id,
        dayKey: new Date().toISOString().slice(0, 10),
      },
    },
  })) !== null;

// СТАЛО:
import { getWeekKey } from '@shared/utils/week-key';

const isLuckyBypass =
  command.lucky &&
  (await this.prisma.luckyWheelUsage.findUnique({
    where: {
      userId_weekKey: {
        userId: user.id,
        weekKey: getWeekKey(),
      },
    },
  })) !== null;
```

---

## 5. Изменения в `GetLuckyWheelStreakHandler` и `LuckyWheelStreakResDto`

Фронту нужно знать, использован ли уже недельный спин, чтобы:
- показать кнопку «Крутить» активной/неактивной
- показать, когда разблокируется следующий стандартный спин

### Добавить поле `hasUsedWeeklySpin` в `LuckyWheelStreakResDto`

```typescript
// src/modules/events/dto/response/lucky-wheel-streak.res.dto.ts
export class LuckyWheelStreakResDto {
  @ApiProperty({ description: 'Текущая серия ежедневных входов' })
  declare currentStreak: number;

  @ApiProperty({ description: 'Дней до следующего фри-спина (1–3)' })
  declare daysUntilFreeSpin: number;

  @ApiProperty({ description: 'Баланс накопленных фри-спинов' })
  declare freeSpinBalance: number;

  @ApiProperty({ description: 'Стандартный (недельный) спин уже использован на этой неделе' })
  declare hasUsedWeeklySpin: boolean;

  @ApiProperty({
    description: 'Дата понедельника следующей недели (UTC) — когда разблокируется стандартный спин',
    example: '2026-03-16',
  })
  declare nextWeekKey: string;
}
```

### Изменения в `GetLuckyWheelStreakHandler`

```typescript
import { getWeekKey } from '@shared/utils/week-key';

// В execute():
const weekKey = getWeekKey();

const [streak, balance, weeklyUsage] = await Promise.all([
  this.prisma.loginStreak.findUnique({ where: { userId: user.id } }),
  this.prisma.freeSpinBalance.findUnique({ where: { userId: user.id } }),
  this.prisma.luckyWheelUsage.findUnique({
    where: { userId_weekKey: { userId: user.id, weekKey } },
  }),
]);

// nextWeekKey — понедельник следующей недели
const nextWeekDate = new Date(weekKey);
nextWeekDate.setUTCDate(nextWeekDate.getUTCDate() + 7);
const nextWeekKey = nextWeekDate.toISOString().slice(0, 10);

result.hasUsedWeeklySpin = weeklyUsage !== null;
result.nextWeekKey = nextWeekKey;
```

---

## 6. Затронутые файлы

| Файл | Изменение |
|---|---|
| `src/prisma/schema.prisma` | `LuckyWheelUsage.dayKey` → `weekKey`, уникальный индекс |
| `src/shared/utils/week-key.ts` | **Новый файл** — утилита `getWeekKey()` |
| `src/shared/utils/index.ts` | Реэкспорт `getWeekKey` |
| `src/modules/events/handlers/get-random-event.handler.ts` | `dayKey` → `weekKey`, `getWeekKey()` |
| `src/modules/events/handlers/join-event.handler.ts` | `dayKey` → `weekKey`, `getWeekKey()` в lucky bypass |
| `src/modules/events/handlers/get-lucky-wheel-streak.handler.ts` | Добавить `weeklyUsage`, `hasUsedWeeklySpin`, `nextWeekKey` |
| `src/modules/events/dto/response/lucky-wheel-streak.res.dto.ts` | Добавить `hasUsedWeeklySpin`, `nextWeekKey` |

---

## 7. Граничные случаи

| Ситуация | Поведение |
|---|---|
| Пользователь крутил в пн, возвращается в пт той же недели | `weekKey` совпадает → только фри-спин |
| Пользователь крутил в вс, возвращается в следующий пн | `weekKey` изменился → стандартный спин разблокирован |
| Пользователь за неделю накопил 2 фри-спина и не крутил стандартный | Может сделать 3 прокрутки: 1 стандартная + 2 фри |
| Фри-спины закончились, стандартный уже использован | `DAILY_LIMIT_REACHED` (сообщение остаётся, смысл: «недельный лимит») |
| Lucky bypass в `JoinEventHandler` — пользователь крутил на прошлой неделе | `weekKey` не совпадает → bypass НЕ действует (ценз проверяется) |
| `FreeSpinBalance` отсутствует в БД (новый пользователь) | `balance ?? 0` → 0 → `DAILY_LIMIT_REACHED` при попытке доп. спина |

---

## 8. Что НЕ входит в эту задачу

- Изменение сообщения об ошибке `DAILY_LIMIT_REACHED` → можно переименовать в `WEEKLY_LIMIT_REACHED`
  в отдельной задаче (требует синхронизации с фронтом).
- Уведомление «Доступен новый спин» в начале недели — отдельная задача.
- Изменение логики начисления фри-спинов (серия входов) — без изменений.
