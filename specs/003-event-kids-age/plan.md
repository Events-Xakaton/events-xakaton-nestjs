# Implementation Plan: Kids Audience Metadata for Events API

**Branch**: `003-event-kids-age` | **Date**: 2026-03-15 | **Spec**: [/Users/frolov.f/hack2026/events-xakaton-nestjs/specs/003-event-kids-age/spec.md](/Users/frolov.f/hack2026/events-xakaton-nestjs/specs/003-event-kids-age/spec.md)
**Input**: Feature specification from `/specs/003-event-kids-age/spec.md`

## Summary

Добавляем в backend-домен и API поля детской аудитории ивента: `isForKids` и `kidsMinAge`. Поля должны поддерживать create/update/read потоки (`GET /events`, `GET /events/:id`, `GET /clubs/:clubId/events`). Дефолт всех текущих и новых событий — взрослый ивент (`false/null`).

## Technical Context

**Stack**: NestJS 11, CQRS, Prisma, PostgreSQL, class-validator, Swagger  
**Pattern**: DTO validation -> Command/Query handlers -> Prisma mapping  
**Storage**: Новые колонки в `Event`  
**Testing**: `npm run typecheck`, `npm run lint -- --fix`, ручной smoke из `quickstart.md`  
**Affected modules**: `events`, `clubs`, `prisma/schema.prisma`

## Constitution Check

`/.specify/memory/constitution.md` не задает блокирующих ограничений. Для фичи достаточно покрыть:
- миграцию и backward compatibility,
- DTO-валидацию,
- консистентность read-контрактов.

Post-design re-check: нарушений нет.

## Project Structure

### Documentation (this feature)

```text
specs/003-event-kids-age/
├── plan.md
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── event-kids-audience.yaml
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── modules/events/
│   ├── dto/request/
│   │   ├── create-event.req.dto.ts
│   │   └── update-event.req.dto.ts
│   ├── dto/response/
│   │   ├── event-list-item.res.dto.ts
│   │   └── event-detail.res.dto.ts
│   └── handlers/
│       ├── create-event.handler.ts
│       ├── update-event.handler.ts
│       ├── list-events.handler.ts
│       └── get-event.handler.ts
└── modules/clubs/
    ├── dto/response/club-event-item.res.dto.ts
    └── handlers/list-club-events.handler.ts
```

## Phase 1 — Schema + migration

- Добавить колонки `isForKids` (Boolean, default false) и `kidsMinAge` (Int?) в `Event`.
- Создать и применить Prisma migration.

## Phase 2 — Request DTO + write handlers

- Расширить `CreateEventReqDto`, `UpdateEventReqDto`.
- Добавить валидацию `kidsMinAge`.
- В `CreateEventHandler` и `UpdateEventHandler` обеспечить правило: `isForKids=false => kidsMinAge=null`.

## Phase 3 — Read DTO + query handlers

- Добавить поля в `EventListItemResDto`, `EventDetailResDto`, `ClubEventItemResDto`.
- Вернуть новые поля в `ListEventsHandler`, `GetEventHandler`, `ListClubEventsHandler`.

## Phase 4 — API docs + contract alignment

- Обновить Swagger descriptions (через DTO).
- Зафиксировать контракт в `specs/003-event-kids-age/contracts/event-kids-audience.yaml`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Nullable age при true-флаге | Нужно поддержать "детский без уточнения возраста" | Обязательный возраст усложняет создание и противоречит требованиям |
