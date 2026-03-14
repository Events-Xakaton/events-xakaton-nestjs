# Progress: Lucky Wheel — Backend

Сверка с `/specs/001-lucky-wheel/spec.md` и `tasks.md`.

---

## Этап 1 — Schema + миграция ✅

**Задачи по спеке:** T004, T005

### Изменения

**`src/prisma/schema.prisma`**
- Добавлена модель `LuckyWheelUsage`:
  - `id` (uuid PK)
  - `userId` (FK → User, CASCADE DELETE)
  - `dayKey` (String, формат `YYYY-MM-DD` UTC)
  - `usedAtUtc` (DateTime, default now)
  - `@@unique([userId, dayKey])` — один запуск в день на пользователя
  - `@@index([userId])`
- В модель `User` добавлена обратная связь `luckyWheelUsages LuckyWheelUsage[]`
- Добавлен `@@index([followedUserId])` на модель `Connection` (из предыдущей задачи)

**`src/prisma/migrations/20260314160000_add_lucky_wheel_and_connection_index/migration.sql`**
- Создан вручную (локальная БД не запущена)
- Содержит: `CREATE INDEX Connection_followedUserId_idx`, `CREATE TABLE LuckyWheelUsage`, индексы и FK

### Применение миграции на сервере

При деплое `npm run prisma:deploy` применит миграцию автоматически.
Вручную:
```bash
npm run prisma:deploy
npm run prisma:generate
```

---

## Этап 2 — Доработка GetRandomEventHandler ✅

**Задачи по спеке:** T006, T007, T008, T023

### Изменения

**`src/modules/events/handlers/get-random-event.handler.ts`**
- [x] Константа `K_NEAREST = 5` на уровне модуля
- [x] Фильтр мест: `maxParticipants === null || _count.participations < maxParticipants` (считаются только `joined`)
- [x] Выбор K=5: сортировка по `startsAtUtc` asc → `slice(0, 5)` → `Math.random()`
- [x] Дневной лимит: `dayKey = toISOString().slice(0,10)` (UTC), `findUnique` до выбора, `create` после
- [x] Коды ошибок: `NO_ELIGIBLE_EVENTS` и `DAILY_LIMIT_REACHED` как `message` в `AppException(NOT_FOUND)`
- [x] Аналитика отказов: `event.random_open_denied` с полем `reason` (T023)
- [x] Аналитика успеха: расширена полями `candidatesCount`, `windowSize`

---

## Этап 3 — Swagger в контроллере ✅

**Задачи по спеке:** T003

### Изменения

**`src/modules/events/events.controller.ts`**
- [x] `@ApiOperation` расширен описанием политики выбора (K=5, фильтры, лимит)
- [x] `@ApiResponse(404)` содержит оба машиночитаемых кода: `NO_ELIGIBLE_EVENTS`, `DAILY_LIMIT_REACHED`

---

## Итог бэкенда ✅

Все три этапа завершены. Бэкендовая часть Lucky Wheel реализована полностью согласно спеке.

### Ожидает применения на сервере

```bash
npm run prisma:deploy   # применит миграцию 20260314160000_add_lucky_wheel_and_connection_index
npm run prisma:generate # обновит Prisma Client
```
