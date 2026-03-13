# CLAUDE.md — events-xakaton-nestjs

Бэкенд для Telegram Mini App **Tribe Events** — платформы клубов и мероприятий с геймификацией.
Монолитный NestJS REST API. Написан под хакатон, судьи оценивают читаемость и архитектуру.

> Дополняет глобальный `~/.claude/CLAUDE.md`. Правила глобального файла действуют здесь в полном объёме.

---

## 1. Команды

```bash
npm run start:dev        # запуск с hot-reload
npm run build            # сборка в dist/
npm run typecheck        # tsc --noEmit (без emit)
npm run lint             # ESLint
npm run lint -- --fix    # ESLint с автофиксом
npm run format           # Prettier (write)
npm run prisma:generate  # регенерация Prisma Client
npm run prisma:migrate   # создать и применить миграцию (dev)
npm run prisma:deploy    # применить миграции (prod/CI)
npm run seed             # наполнить БД тестовыми данными
```

Swagger UI: `http://localhost:4000/api/docs` (только не-production).
Метрики Prometheus: `http://localhost:4000/api/metrics`.

---

## 2. Архитектура

### Слои приложения

```
Telegram Mini App → HTTP → Middleware → Guard → Controller
                                                    ↓
                                            CommandBus / QueryBus
                                                    ↓
                                            CommandHandler / QueryHandler
                                                    ↓
                                    PrismaService / PointsService / QueueService / ...
```

- **Контроллеры** — маршрутизация, десериализация DTO, вызов bus. Никакой бизнес-логики.
- **CommandHandler** — любая мутация состояния.
- **QueryHandler** — любое чтение.
- **Services** — только инфраструктурные: `NotificationsService` (createInAppNotification),
  `VerificationService` (OTP), `EventStatusService`, `PointsService`, `AnalyticsService`.

### Обработка ошибок

Ошибки **возвращаются**, не бросаются:

```typescript
return new GeneralApiResponseDto(HttpStatus.NOT_FOUND, 'Ресурс не найден', null as never);
```

Исключения — только `VerificationService` (нейтральные сообщения безопасности) и
`UserContextService.requireUserByTelegram` (401). Оба перехватываются глобальными фильтрами.

`TransformResponseInterceptor` превращает `GeneralApiResponseDto` с кодом ≠ 200/201 в `HttpException`.

### Аналитика — только fire-and-forget

```typescript
void this.analyticsService.track({ eventName: 'club.created', context: { clubId } });
```

Никогда не `await`. Ошибка в аналитике не должна ломать основной поток.

---

## 3. Структура модулей

| Модуль | Путь | Что делает |
|---|---|---|
| auth | `src/modules/auth` | OTP через Reddy, привязка Telegram → Reddy аккаунт |
| clubs | `src/modules/clubs` | CRUD клубов, членство, роли участников |
| events | `src/modules/events` | CRUD мероприятий, участие, фидбэк, статусы |
| comments | `src/modules/comments` | Комментарии к клубам и событиям |
| connections | `src/modules/connections` | Подписки пользователей (follow/unfollow) |
| gamification | `src/modules/gamification` | Баланс очков, история, лидерборд |
| notifications | `src/modules/notifications` | In-app уведомления с cursor-пагинацией |
| admin | `src/modules/admin` | Назначение ролей, сводный отчёт |

### Структура модуля (шаблон)

```
src/modules/<name>/
├── commands/          # CommandXxx.ts + index.ts
├── queries/           # QueryXxx.ts + index.ts
├── handlers/          # XxxHandler.ts + index.ts
├── dto/
│   ├── request/       # XxxReqDto + index.ts
│   └── response/      # XxxResDto + index.ts
├── <name>.controller.ts
└── <name>.module.ts
```

---

## 4. Инфраструктурные сервисы

### PointsService (`src/points/points.service.ts`) — @Global()

Доступен в любом модуле без явного импорта.

```typescript
// Начислить очки (идемпотентно по userId + ruleCode + referenceId)
await this.pointsService.award({
  userId: user.id,
  ruleCode: 'event_join',
  deltaPoints: 1,
  referenceId: eventId,   // предотвращает двойное начисление
  eventId,
});

// Откат (отрицательная запись)
await this.pointsService.rollback({ userId: user.id, ruleCode: 'event_join', referenceId: eventId });
```

**Правила начисления (hardcoded в GetPointsRulesHandler):**

| ruleCode | points |
|---|---|
| club_create | 10 |
| event_create | 8 |
| club_join | 3 |
| event_join | 1 |
| attendance_feedback | 4 |
| club_new_member_bonus | 1 |

### QueueService (`src/jobs/queue.service.ts`)

```typescript
// Поставить задачу
await this.queueService.enqueue(QueueName.Reminders, { userId, eventId, ... }, {
  jobId: `reminder:${eventId}:${userId}`,
  delay: msUntilEvent,
});

// Отменить задачу по ключу
await this.queueService.removeByDedupKey(QueueName.Reminders, `reminder:${eventId}:${userId}`);
```

Имена очередей — в `src/jobs/queue.types.ts`: `otp-send`, `reminders`, `event-changed`, `retention-cleanup`.

### NotificationsService (`src/modules/notifications/notifications.service.ts`)

Экспортируется из `NotificationsModule`. Используется для создания уведомлений из других модулей.

```typescript
void this.notificationsService.createInAppNotification({
  userId: targetUser.id,
  type: 'new_follower',   // или 'event_changed'
  title: 'Заголовок',
  body: 'Текст уведомления',
  targetType: 'event',    // опционально
  targetId: eventId,      // опционально
});
```

Вызов — **fire-and-forget** (void, не await).

### AnalyticsService (`src/analytics/analytics.service.ts`)

```typescript
void this.analyticsService.track({
  eventName: 'event.joined',
  userId: user.id,           // строка UUID
  entityType: 'event',
  entityId: eventId,
  context: { clubId },       // любые доп. данные
});
```

---

## 5. База данных

**Провайдер:** PostgreSQL. **ORM:** Prisma.
Схема: `src/prisma/schema.prisma`.

### Ключевые модели

- `User` — `telegramUserId` (BigInt, unique). UUID primary key.
- `PointsLedger` — append-only, уникальный индекс `(userId, ruleCode, referenceId)`.
- `ClubMembership` — composite PK `(clubId, userId)`. Роли: owner, admin, event_manager, member.
- `EventParticipation` — composite PK `(eventId, userId)`.
- `Connection` — composite PK `(followerUserId, followedUserId)`.
- `Notification` — типы в БД: `new_follower | event_changed`. В API `new_follower` → `member_joined`.

### Работа с BigInt

`telegramUserId` хранится как `BigInt`. При сравнении:
```typescript
where: { telegramUserId: BigInt(telegramUserIdString) }
```

В ответах API: `user.telegramUserId.toString()`.

### Soft delete

Клубы, события, комментарии имеют поле `isDeleted: boolean`. Всегда добавляй `isDeleted: false` в WHERE при выборке.

---

## 6. Аутентификация и роли

### Как Telegram ID попадает в хэндлер

`TelegramInitDataMiddleware` разбирает заголовок `x-telegram-init-data` и кладёт `telegramUserId` в `req`.
Контроллер передаёт его в команду/запрос:

```typescript
new SomeCommand(req.telegramUserId, dto)
```

Хэндлер вызывает `userContextService.requireUserByTelegram(telegramUserId)` — получает или создаёт User.

### Роли

```typescript
@Roles('Member')       // обязательная роль — любой авторизованный пользователь
@Roles('ClubAdmin')    // менеджер клуба
@Roles('PlatformAdmin') // глобальный администратор
```

`RbacGuard` (глобальный) проверяет роль через `UserRole` в БД.

---

## 7. Статусы событий

`EventStatusService` (`src/modules/events/event-status.service.ts`) вычисляет статус по времени:

```
startsAtUtc > now  → upcoming
startsAtUtc ≤ now < endsAtUtc  → ongoing
endsAtUtc ≤ now  → past
status === 'cancelled'  → cancelled (приоритет)
```

В `ListClubEventsHandler` статус вычисляется дублированным приватным методом `computeEventStatus` — **намеренно**, чтобы избежать циклического импорта `clubs ↔ events`.

---

## 8. Переменные окружения

Все переменные — в `.env`, описаны в `.env.example`:

| Переменная | Описание |
|---|---|
| DATABASE_URL | PostgreSQL connection string |
| REDIS_URL | Redis connection string |
| TELEGRAM_BOT_TOKEN | Токен Telegram бота (валидация init-data) |
| REDDY_BOT_BASE_URL | Базовый URL Reddy API |
| REDDY_BOT_TOKEN | Токен Reddy бота (mock-режим если пусто) |
| PORT | HTTP порт (default 4000) |
| OTEL_ENABLED | Включить OpenTelemetry (true/false) |
| DLQ_NAME | Имя очереди мёртвых писем (default dead-letter) |

---

## 9. Что не трогать без явного запроса

- `src/shared/` — изменяй только при необходимости; паттерны стабилизированы.
- `src/modules/notifications/notifications.service.ts` — `createInAppNotification` и `cleanupExpired` используются в других модулях; сервис сохранён намеренно рядом с CQRS-хэндлерами.
- `src/modules/auth/verification.service.ts` — намеренно использует `throw` для нейтральных OTP-ошибок (требование безопасности).
- `src/modules/events/event-status.service.ts` — injectable util; не конвертировать в handler.
- `src/prisma/schema.prisma` — не изменяй без `prisma migrate dev`.
