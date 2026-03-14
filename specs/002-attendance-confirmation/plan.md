# Implementation Plan: Attendance Confirmation

**Branch**: `002-attendance-confirmation` | **Date**: 2026-03-14
**Spec**: `specs/002-attendance-confirmation/spec.md`

## Summary

Добавляем возможность создателю завершённого события (`past`) подтвердить присутствие участников одним bulk-запросом с опциональной оценкой 1–5. Оценка = количество начисленных очков. Участник получает уведомление в Telegram-бот. Повторная отправка запрещена. Флаг `attendanceConfirmed` добавляется в детали события.

## Technical Context

**Stack**: NestJS 11, CQRS, Prisma, PostgreSQL, nestjs-telegraf
**Pattern**: CommandHandler для мутации, обновление QueryHandler для флага
**Points**: `PointsService.award` (global, уже доступен без импорта)
**Notifications**: `bot.telegram.sendMessage` через `@InjectBot()`
**Affected modules**: `events`, `prisma/schema.prisma`

## Phase 1 — Schema + миграция

**Файл**: `src/prisma/schema.prisma`

- Добавить модель `AttendanceConfirmation`
- Создать и применить миграцию

## Phase 2 — Command + Handler

**Файлы**:
- `src/modules/events/commands/confirm-attendance.command.ts`
- `src/modules/events/handlers/confirm-attendance.handler.ts`
- `src/modules/events/dto/request/confirm-attendance.req.dto.ts`

Логика хэндлера:
1. Получить пользователя по `telegramUserId`
2. Найти событие, проверить `isDeleted: false`
3. Проверить `creatorUserId === user.id` → иначе `403`
4. Проверить `computedStatus === past` → иначе `400`
5. Проверить отсутствие существующих подтверждений → иначе `409`
6. Загрузить joined-участников события
7. Для каждого `attendance` из запроса: если userId есть среди участников — создать `AttendanceConfirmation`, начислить очки (если rating), отправить уведомление (fire-and-forget)
8. Вернуть `{ status: 'ok' }`

## Phase 3 — Обновление GetEventHandler

**Файл**: `src/modules/events/handlers/get-event.handler.ts`

- Добавить `attendanceConfirmed: boolean` в select/response
- Вычислять через `prisma.attendanceConfirmation.count({ where: { eventId } }) > 0`

## Phase 4 — Обновление EventDetailResDto

**Файл**: `src/modules/events/dto/response/event-detail.res.dto.ts`

- Добавить поле `attendanceConfirmed: boolean` с `@ApiProperty`

## Phase 5 — Контроллер + регистрация

**Файлы**:
- `src/modules/events/events.controller.ts` — новый `POST :eventId/attendance`
- `src/modules/events/events.module.ts` — регистрация хэндлера

## Порядок выполнения

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
```

Phase 1 блокирует Phase 2 (нужна таблица в Prisma Client).
Phase 3 и Phase 4 можно делать параллельно после Phase 1.
