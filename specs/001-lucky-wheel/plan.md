# Implementation Plan: Lucky Wheel for Events

**Branch**: `001-lucky-wheel` | **Date**: 2026-03-14 | **Spec**: [/Users/frolov.f/hack2026/specs/001-lucky-wheel/spec.md](/Users/frolov.f/hack2026/specs/001-lucky-wheel/spec.md)
**Input**: Feature specification from `/specs/001-lucky-wheel/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Добавляем скрытую механику `Мне повезет` в `Home -> Events`: после быстрого скролла (9 просмотренных карточек < 3 сек) появляется секретная кнопка, открывающая экран колеса. Нажатие `Запустить` выполняет предопределенный выбор события через `GET /events/random`, где сервер применяет фильтры доступности и политику random из окна ближайших `K=5`. Также вводится серверный лимит: не более одного запуска в UTC-день пользователя.

## Technical Context

**Language/Version**: TypeScript (Next.js 16 + React 19, NestJS 11, Node >=20)  
**Primary Dependencies**: RTK Query, Redux Toolkit, NestJS CQRS, Prisma  
**Storage**: PostgreSQL через Prisma (existing DB), дополнительная server-side запись дневного лимита lucky-механики  
**Testing**: ESLint, TypeScript typecheck, ручные smoke-сценарии из quickstart  
**Target Platform**: Telegram Mini App Web + NestJS API  
**Project Type**: Web application (frontend + backend)  
**Performance Goals**: API выбора события p95 < 300ms на типовом объеме; анимация колеса 2-4 сек без заметных лагов  
**Constraints**: Выбор только из `upcoming`, где пользователь не joined и есть места; `K=5`; лимит 1 запуск/день только на сервере, граница дня в `00:00 UTC`  
**Scale/Scope**: Изменения в 2 проектах (`events-xakaton-next`, `events-xakaton-nestjs`), 1 новый экран, доработка random endpoint и добавление server quota

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`/.specify/memory/constitution.md` содержит шаблон-заглушку без активных принципов и обязательных гейтов. Явных блокирующих ограничений для этой фичи не обнаружено.

Post-design re-check: без изменений, нарушений не выявлено.

## Project Structure

### Documentation (this feature)

```text
specs/001-lucky-wheel/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── lucky-wheel-random-event.yaml
└── tasks.md
```

### Source Code (repository root)

```text
events-xakaton-next/src/
├── views/
│   ├── home/
│   │   ├── index.tsx
│   │   └── model/
│   │       └── use-lucky-trigger.ts
│   ├── lucky-wheel/
│   │   └── index.tsx
│   └── shell/
│       └── index.tsx
└── entities/event/
    └── api.ts

events-xakaton-nestjs/src/modules/events/
├── events.controller.ts
├── queries/
│   └── get-random-event.query.ts
└── handlers/
    └── get-random-event.handler.ts

# If dedicated persistence is introduced for daily quota:
events-xakaton-nestjs/src/prisma/
└── schema.prisma
```

**Structure Decision**: используем существующий random endpoint как источник предопределенного результата, дополняем серверной политикой выбора и дневным лимитом; во фронте добавляем изолированный экран колеса и хук детектора быстрого скролла.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Доп. server-side состояние для daily quota | Нужен необходимый лимит 1/день, не обходится клиентом | Только клиентская проверка небезопасна и обходится |
