# Спека: минимальный уровень участников события

## Суть задачи

Организатор при создании (и редактировании) события может указать минимальный ранг участников.
Пользователь с уровнем ниже указанного не сможет записаться — получит внятную ошибку.
Поле опциональное: `null` означает «без ограничений».

---

## 1. Изменения схемы БД

### `schema.prisma` — модель `Event`

Добавить одно поле:

```prisma
model Event {
  // ... существующие поля ...
  maxParticipants Int?
  minLevel        Int?   // ← новое: минимальный уровень (1–10), null = без ограничений

  // ...
}
```

**Ограничения на уровне БД:** нет (валидация — в DTO и хэндлере).

После изменения схемы:
```bash
npm run prisma:migrate   # создаёт миграцию: add_min_level_to_event
npm run prisma:generate  # регенерация клиента
```

---

## 2. Изменения DTO

### `CreateEventReqDto`

Добавить опциональное поле:

```typescript
@ApiPropertyOptional({
  description: 'Минимальный уровень участника (1–10). null — без ограничений.',
  minimum: 1,
  maximum: 10,
  nullable: true,
})
@IsOptional()
@IsInt()
@Min(1)
@Max(10)
minLevel?: number;
```

### `UpdateEventReqDto`

Добавить то же поле:

```typescript
@ApiPropertyOptional({
  description: 'Минимальный уровень участника (1–10). null — снять ограничение.',
  minimum: 1,
  maximum: 10,
  nullable: true,
})
@IsOptional()
@IsInt()
@Min(1)
@Max(10)
minLevel?: number | null;   // null явно снимает ограничение
```

> В `UpdateEventReqDto` тип `number | null` — потому что организатор должен уметь
> убрать уже выставленное ограничение, передав `null`.
> `undefined` (поле отсутствует в теле) означает «не трогать текущее значение».

### `EventDetailResDto` и `EventListItemResDto`

В **`EventDetailResDto`** добавить поле (для страницы события):

```typescript
@ApiProperty({
  description: 'Минимальный уровень участника (null — без ограничений)',
  nullable: true,
})
readonly minLevel: number | null;

// + в конструктор:
this.minLevel = data.minLevel;
```

В **`EventListItemResDto`** добавить поле (для карточки в списке — фронт показывает иконку замка):

```typescript
@ApiProperty({ nullable: true })
readonly minLevel: number | null;
```

---

## 3. Изменения хэндлеров

### `CreateEventHandler`

В `prisma.event.create` добавить поле:

```typescript
data: {
  // ... существующие поля ...
  minLevel: dto.minLevel ?? null,
}
```

### `UpdateEventHandler`

В `prisma.event.update` добавить поле (передавать только если поле присутствует в dto):

```typescript
// Паттерн: undefined — не трогать, null — обнулить, number — обновить
...(dto.minLevel !== undefined && { minLevel: dto.minLevel }),
```

### `GetEventHandler` / `GetEventDetailHandler`

В `select` добавить `minLevel: true`, пробросить в конструктор `EventDetailResDto`.

### `ListEventsHandler` / `ListClubEventsHandler`

В `select` добавить `minLevel: true`, пробросить в `EventListItemResDto`.

### `JoinEventHandler` ← **ключевое изменение**

После существующих проверок (событие найдено, статус подходит, есть места) добавить проверку уровня:

```typescript
if (event.minLevel !== null) {
  // Получаем lifetime-сумму очков пользователя
  const ledger = await this.prisma.pointsLedger.aggregate({
    where: { userId: user.id },
    _sum: { deltaPoints: true },
  });
  const lifetimePoints = ledger._sum.deltaPoints ?? 0;
  const userLevel = computeRank(lifetimePoints).level;

  if (userLevel < event.minLevel) {
    const requiredRank = RANKS.find((r) => r.level === event.minLevel);
    throw new AppException({
      statusCode: HttpStatus.FORBIDDEN,
      message: `Для записи на это событие нужен уровень ${event.minLevel} · ${requiredRank?.title ?? ''}`,
    });
  }
}
```

> `computeRank` и `RANKS` уже существуют в `@shared/utils/compute-rank` и `@shared/constants`.
> `JoinEventHandler` уже импортирует `POINTS` из `@shared/constants` — добавить `RANKS` туда же.

В запросе `prisma.event.findFirst` в `JoinEventHandler` добавить `minLevel: true` в `select` модели.

---

## 4. Порядок проверок в `JoinEventHandler`

Итоговая последовательность guard-блоков (все через `throw new AppException`):

```
1. Событие существует и не удалено           → 404
2. Статус события — не Past и не Cancelled   → 400
3. Есть свободные места (maxParticipants)    → 400 «Свободных мест нет»
4. Уровень пользователя >= minLevel          → 403 «Нужен уровень N · Название»
```

Порядок важен: проверку уровня ставим **после** проверки мест — попытка записаться на уже заполненное событие должна давать «мест нет», а не «уровень не тот».

---

## 5. Затронутые файлы

| Файл | Что меняется |
|---|---|
| `src/prisma/schema.prisma` | `Int? minLevel` в модели `Event` |
| `src/modules/events/dto/request/create-event.req.dto.ts` | `minLevel?: number` |
| `src/modules/events/dto/request/update-event.req.dto.ts` | `minLevel?: number \| null` |
| `src/modules/events/dto/response/event-detail.res.dto.ts` | `minLevel: number \| null` |
| `src/modules/events/dto/response/event-list-item.res.dto.ts` | `minLevel: number \| null` |
| `src/modules/events/handlers/create-event.handler.ts` | передать `minLevel` в `create` |
| `src/modules/events/handlers/update-event.handler.ts` | передать `minLevel` в `update` |
| `src/modules/events/handlers/get-event.handler.ts` | `select minLevel`, пробросить в DTO |
| `src/modules/events/handlers/list-events.handler.ts` | `select minLevel`, пробросить в DTO |
| `src/modules/clubs/handlers/list-club-events.handler.ts` | `select minLevel`, пробросить в DTO |
| `src/modules/events/handlers/join-event.handler.ts` | guard по уровню (ключевое) |

---

## 6. Ошибки

| Ситуация | HTTP | Сообщение |
|---|---|---|
| Уровень пользователя < `minLevel` | 403 | `«Для записи на это событие нужен уровень 5 · Завсегдатай»` |
| `minLevel` вне диапазона 1–10 в запросе | 400 | стандартный ответ class-validator |

---

## 7. Seed

В `src/prisma/seed.ts` добавить `minLevel` в несколько событий для демонстрации фичи:

```typescript
// При создании событий указать minLevel для 3–4 событий:
// upcomingFarTech     → minLevel: 4  (хакатон — нужны опытные)
// upcomingReact       → minLevel: 3
// ongoingTech         → minLevel: 2
// остальные           → minLevel: null (без ограничений)
```

---

## 8. Что НЕ входит в эту задачу

- Уведомление пользователю при повышении уровня о том, что теперь доступны новые события — отдельная задача.
- Фильтрация списка событий по `minLevel <= userLevel` — отдельная задача (сейчас события с ограничением видны всем, но записаться нельзя).
- Принудительное исключение участников при повышении `minLevel` на уже существующем событии — не реализуется, уже записавшиеся остаются.
