# Спека (бэкенд): серия входов 7 дней → фри-спин на Lucky Wheel

**Папка:** `specs/`
**Статус:** Draft
**Зависит от:** 001-lucky-wheel (реализован)

---

## Суть задачи

Если пользователь открывает приложение 3 дня подряд — он получает один дополнительный спин на Lucky Wheel.
Фри-спин накапливается на балансе и тратится, когда пользователь использует Lucky Wheel в день, когда стандартный суточный спин уже израсходован.

---

## Концептуальные решения

### Что считается «входом в приложение»

Любой аутентифицированный запрос через `TelegramInitDataMiddleware`. Обработка выполняется **один раз в день** (по UTC) через проверку `dayKey`.

### Как считается серия

- Серия инкрементируется, если `lastLoginDay === вчера (UTC)`.
- Если последний вход был раньше чем вчера — серия сбрасывается в `1`.
- Повторные входы в тот же день `lastLoginDay === сегодня` — ничего не делают (идемпотентно).

### Когда выдаётся фри-спин

При каждом достижении `currentStreak % 3 === 0` (то есть день 3, 6, 9 и т.д.) — баланс фри-спинов увеличивается на 1. Серия **не сбрасывается** после выдачи — она продолжает расти.

### Как тратится фри-спин

В `GetRandomEventHandler`: если `LuckyWheelUsage` на сегодня уже существует (стандартный спин использован) И `FreeSpinBalance.balance > 0` — спин разрешается, баланс уменьшается на 1.

### Идемпотентность выдачи

Выдача фри-спина защищена `referenceId = free_spin_streak_${userId}_${dayKey}` в отдельной таблице журнала выдач — повторный вызов не двойно зачтёт.

---

## 1. Изменения схемы БД

### Новые модели

```prisma
// Серия ежедневных входов пользователя
model LoginStreak {
  userId        String   @id
  currentStreak Int      @default(1)
  lastLoginDay  String   // "YYYY-MM-DD" UTC
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// Баланс фри-спинов (накапливается, тратится)
model FreeSpinBalance {
  userId   String @id
  balance  Int    @default(0)
  user     User   @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// Журнал выданных фри-спинов — для идемпотентности
model FreeSpinGrant {
  id          String   @id @default(uuid())
  userId      String
  referenceId String   @unique  // "free_spin_streak_${userId}_${dayKey}"
  grantedAt   DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

### Связи в модели `User`

```prisma
model User {
  // ... существующие поля ...
  loginStreak     LoginStreak?
  freeSpinBalance FreeSpinBalance?
  freeSpinGrants  FreeSpinGrant[]
}
```

### Миграция

```bash
npm run prisma:migrate -- --name add_login_streak_and_free_spin
npm run prisma:generate
```

---

## 2. Логика обновления серии

### Где живёт

Новый приватный метод `syncLoginStreak(userId: string)` в `TelegramInitDataMiddleware`.
Вызывается fire-and-forget из `syncUserProfile` после `upsert` пользователя:

```typescript
// В syncUserProfile, после upsert:
void this.syncLoginStreak(upserted.id);
```

### Псевдокод

```typescript
private async syncLoginStreak(userId: string): Promise<void> {
  const today     = new Date().toISOString().slice(0, 10);       // "2026-03-15"
  const yesterday = new Date(Date.now() - 86400_000)
                      .toISOString().slice(0, 10);               // "2026-03-14"

  const streak = await prisma.loginStreak.findUnique({ where: { userId } });

  // Идемпотентность: уже обработали сегодня
  if (streak?.lastLoginDay === today) return;

  const prevStreak = streak?.currentStreak ?? 0;
  const isConsecutive = streak?.lastLoginDay === yesterday;
  const newStreak = isConsecutive ? prevStreak + 1 : 1;

  await prisma.loginStreak.upsert({
    where: { userId },
    update: { currentStreak: newStreak, lastLoginDay: today },
    create: { userId, currentStreak: newStreak, lastLoginDay: today },
  });

  // Кратность 3 — выдаём фри-спин (день 3, 6, 9 ...)
  if (newStreak % 3 === 0) {
    const referenceId = `free_spin_streak_${userId}_${today}`;
    const alreadyGranted = await prisma.freeSpinGrant.findUnique({
      where: { referenceId },
    });
    if (!alreadyGranted) {
      await prisma.$transaction([
        prisma.freeSpinGrant.create({ data: { userId, referenceId } }),
        prisma.freeSpinBalance.upsert({
          where:  { userId },
          update: { balance: { increment: 1 } },
          create: { userId, balance: 1 },
        }),
      ]);
    }
  }
}
```

### Зависимости в конструкторе `TelegramInitDataMiddleware`

`TelegramInitDataMiddleware` уже инжектирует `PrismaService` и `PointsService`.
Новых зависимостей не требуется — `PrismaService` покрывает всё.

---

## 3. Изменения в `GetRandomEventHandler`

### Текущая логика

```
1. LuckyWheelUsage для сегодня существует → throw DAILY_LIMIT_REACHED
2. Выбрать случайное событие
3. Создать LuckyWheelUsage
4. Вернуть id
```

### Новая логика

```
1. LuckyWheelUsage для сегодня НЕ существует → стандартный спин (без изменений)
2. LuckyWheelUsage СУЩЕСТВУЕТ:
   a. FreeSpinBalance.balance > 0 → фри-спин: декремент баланса, пропустить шаг создания LuckyWheelUsage
   b. balance === 0              → throw DAILY_LIMIT_REACHED (без изменений)
3. Выбрать случайное событие (логика без изменений)
4. Если стандартный спин → создать LuckyWheelUsage
5. Вернуть { id, usedFreeSpin: boolean }
```

### Изменение ответа

Добавить `usedFreeSpin: boolean` в ответ — фронт использует это для показа анимации «фри-спин».

```typescript
// IdResDto → расширить или создать новый DTO:
export class RandomEventResDto {
  @ApiProperty() id: string;
  @ApiProperty({ description: 'Использован фри-спин (не стандартный суточный)' })
  usedFreeSpin: boolean;
}
```

### Псевдокод хэндлера (дополнение)

```typescript
const existingUsage = await this.prisma.luckyWheelUsage.findUnique({
  where: { userId_dayKey: { userId: user.id, dayKey } },
});

let usedFreeSpin = false;

if (existingUsage) {
  // Проверяем баланс фри-спинов
  const freeSpinBalance = await this.prisma.freeSpinBalance.findUnique({
    where: { userId: user.id },
  });
  if (!freeSpinBalance || freeSpinBalance.balance <= 0) {
    void this.analyticsService.track({ eventName: 'event.random_open_denied', ... });
    throw new AppException({ statusCode: HttpStatus.NOT_FOUND, message: 'DAILY_LIMIT_REACHED' });
  }
  // Тратим фри-спин
  await this.prisma.freeSpinBalance.update({
    where: { userId: user.id },
    data: { balance: { decrement: 1 } },
  });
  usedFreeSpin = true;
}

// ... существующая логика выбора события ...

// Фиксируем LuckyWheelUsage только для стандартного спина
if (!usedFreeSpin) {
  await this.prisma.luckyWheelUsage.create({ data: { userId: user.id, dayKey } });
}

void this.analyticsService.track({
  eventName: 'event.random_open',
  context: { ..., usedFreeSpin },
});

return { id: pick.id, usedFreeSpin };
```

---

## 4. Новый эндпоинт: баланс серии и фри-спинов

Фронту нужно знать текущую серию и баланс для отображения UI.

### Эндпоинт

```
GET /lucky-wheel/streak
Headers: x-telegram-init-data
Roles: Member
```

### Ответ

```typescript
export class LuckyWheelStreakResDto {
  @ApiProperty({ description: 'Текущая серия ежедневных входов' })
  currentStreak: number;

  @ApiProperty({ description: 'Дней до следующего фри-спина (1–7)' })
  daysUntilFreeSpin: number;

  @ApiProperty({ description: 'Баланс фри-спинов' })
  freeSpinBalance: number;
}
```

`daysUntilFreeSpin = 3 - (currentStreak % 3)` — сколько дней до следующей награды (1 или 2).

### Где разместить

В существующем `EventsController` или создать `LuckyWheelController`. Предпочтительно — отдельный `LuckyWheelController` в модуле `events`, чтобы не перегружать `EventsController`.

### QueryHandler

```
GetLuckyWheelStreakQuery(telegramUserId)
→ GetLuckyWheelStreakHandler
→ SELECT LoginStreak + FreeSpinBalance для userId
→ LuckyWheelStreakResDto
```

---

## 5. Аналитика

Добавить трекинг в `syncLoginStreak` fire-and-forget:

```typescript
// При инкременте серии
void this.analyticsService.track({
  eventName: 'user.streak_updated',
  userId,
  context: { newStreak, isConsecutive },
});

// При выдаче фри-спина
void this.analyticsService.track({
  eventName: 'user.free_spin_granted',
  userId,
  context: { streak: newStreak, dayKey },
});
```

В `GetRandomEventHandler` уже есть трекинг `event.random_open` — добавить `usedFreeSpin` в `context`.

---

## 6. Затронутые файлы

| Файл | Что делать |
|---|---|
| `src/prisma/schema.prisma` | Новые модели `LoginStreak`, `FreeSpinBalance`, `FreeSpinGrant`; связи в `User` |
| `src/shared/auth/telegram-init-data.middleware.ts` | Метод `syncLoginStreak`, вызов fire-and-forget |
| `src/modules/events/handlers/get-random-event.handler.ts` | Логика фри-спина, изменение ответа |
| `src/modules/events/dto/response/` | Новый `RandomEventResDto` (id + usedFreeSpin) |
| `src/modules/events/queries/` | `GetLuckyWheelStreakQuery` |
| `src/modules/events/handlers/` | `GetLuckyWheelStreakHandler` |
| `src/modules/events/dto/response/` | `LuckyWheelStreakResDto` |
| `src/modules/events/events.controller.ts` или новый контроллер | `GET /lucky-wheel/streak` |
| `src/modules/events/events.module.ts` | Регистрация нового хэндлера |
| `src/prisma/seed.ts` | Опционально: заполнить `LoginStreak` и `FreeSpinBalance` для демо-пользователей |

---

## 7. Граничные случаи

| Ситуация | Поведение |
|---|---|
| Пользователь впервые открывает приложение | `LoginStreak` создаётся с `currentStreak=1`, `lastLoginDay=today` |
| Пользователь делает несколько запросов в день | Только первый обрабатывается (`lastLoginDay === today` → skip) |
| Пользователь пропустил день (например, day 6 → day 8) | Серия сбрасывается в `1`, фри-спин не выдаётся |
| Пользователь достиг дня 7 и снова нажал Lucky Wheel дважды | Второй вызов — balance = 0 → `DAILY_LIMIT_REACHED` |
| Пользователь не использовал фри-спин в день получения | Он остаётся на балансе — можно использовать в любой день |
| Фри-спины накапливаются (дни 3, 6, 9) | `FreeSpinBalance.balance` растёт до накопленного числа |
| Пересечение полуночи UTC | `dayKey` меняется → серия корректно инкрементируется при следующем входе |

---

## 8. Что НЕ входит в эту задачу

- Push-уведомление «Ты близко к фри-спину (осталось X дней)» — отдельная задача.
- Отображение прогресса серии на экране Lucky Wheel — фронтовая задача (спека отдельно).
- Начисление очков за серию (например, `streak_bonus`) — можно добавить позже к `syncLoginStreak`.
- Сброс серии при удалении аккаунта — покрывается `onDelete: Cascade` в схеме.
