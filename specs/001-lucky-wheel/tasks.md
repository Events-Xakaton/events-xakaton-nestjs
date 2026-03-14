# Tasks: Lucky Wheel for Events

**Input**: Design documents from `/specs/001-lucky-wheel/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Автотесты в спецификации явно не запрошены, поэтому в этом плане фокус на реализации + ручной smoke из quickstart.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Подготовить конфиги и контракты фичи в обеих частях проекта.

- [ ] T001 Добавить constants для lucky-механики (`minViewedEvents=9`, `triggerWindowMs=3000`, `kNearest=5`) в `events-xakaton-next/src/views/home/model/use-lucky-trigger.ts`.
- [ ] T002 Добавить типы/контракт ошибок random endpoint (`NO_ELIGIBLE_EVENTS`, `DAILY_LIMIT_REACHED`) в `events-xakaton-next/src/entities/event/api.ts`.
- [ ] T003 Синхронизировать API-контракт с backend-документацией в `events-xakaton-nestjs/src/modules/events/events.controller.ts` с опорой на `specs/001-lucky-wheel/contracts/lucky-wheel-random-event.yaml`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Серверные изменения, без которых US2/US3 невалидны.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Добавить серверное хранилище дневного лимита (модель и индексы) в `events-xakaton-nestjs/src/prisma/schema.prisma`.
- [ ] T005 Создать и применить миграцию для дневного лимита через `events-xakaton-nestjs/src/prisma/migrations/` (generated files).
- [ ] T006 Реализовать проверку лимита 1 запуск/день по UTC-дате (`00:00 UTC`) в `events-xakaton-nestjs/src/modules/events/handlers/get-random-event.handler.ts`.
- [ ] T007 Доработать выбор random event: фильтр upcoming/not-joined/with-spots + выбор из ближайших `K=5` в `events-xakaton-nestjs/src/modules/events/handlers/get-random-event.handler.ts`.
- [ ] T008 Возвращать машинно-читаемые коды ошибок для 404 (`NO_ELIGIBLE_EVENTS`, `DAILY_LIMIT_REACHED`) в `events-xakaton-nestjs/src/modules/events/handlers/get-random-event.handler.ts`.

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Секретный вход в механику (Priority: P1) 🎯 MVP

**Goal**: Показать кнопку `Мне повезет` после быстрого скролла (9 просмотренных ивентов < 3 сек).

**Independent Test**: На `Home -> Events` быстрым скроллом просмотреть 9 карточек менее чем за 3 сек и проверить появление кнопки; при медленном скролле кнопка не появляется.

### Implementation for User Story 1

- [ ] T009 [P] [US1] Реализовать хук детектора viewport-просмотров и временного окна в `events-xakaton-next/src/views/home/model/use-lucky-trigger.ts`.
- [ ] T010 [US1] Подключить `use-lucky-trigger` к ленте ивентов в `events-xakaton-next/src/views/home/index.tsx`.
- [ ] T011 [US1] Пробросить `data-event-id`/ref для отслеживания просмотренных карточек в `events-xakaton-next/src/entities/event/ui/event-feed-card.tsx`.
- [ ] T012 [US1] Отобразить и скрывать кнопку `Мне повезет` на `Home -> Events` по состоянию триггера в `events-xakaton-next/src/views/home/index.tsx`.
- [ ] T013 [US1] Добавить фронтовую телеметрию раскрытия секрета (`lucky.reveal`) в `events-xakaton-next/src/views/home/index.tsx` и `events-xakaton-next/src/shared/observability/telemetry.ts`.

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Колесо и запуск (Priority: P1)

**Goal**: Открыть экран колеса, выполнить один запуск, остановиться на предопределенном event и перейти в детали.

**Independent Test**: Нажать `Мне повезет` -> `Запустить` -> дождаться остановки колеса -> открыть `EventDetails` выбранного id.

### Implementation for User Story 2

- [ ] T014 [P] [US2] Создать экран `LuckyWheelScreen` в `events-xakaton-next/src/views/lucky-wheel/index.tsx`.
- [ ] T015 [US2] Интегрировать экран в навигацию shell и возврат назад в `events-xakaton-next/src/views/shell/index.tsx`.
- [ ] T016 [US2] Реализовать lazy-вызов `/events/random` и lock от повторного запуска в `events-xakaton-next/src/views/lucky-wheel/index.tsx`.
- [ ] T017 [US2] Реализовать анимацию вращения с остановкой на заранее полученном результате в `events-xakaton-next/src/views/lucky-wheel/index.tsx`.
- [ ] T018 [US2] Добавить переход в детали ивента после завершения вращения через `onOpenEvent` в `events-xakaton-next/src/views/shell/index.tsx`.
- [ ] T019 [US2] Добавить события телеметрии (`lucky.spin_start`, `lucky.spin_result`, `lucky.open_event`) в `events-xakaton-next/src/views/lucky-wheel/index.tsx` и `events-xakaton-next/src/shared/observability/telemetry.ts`.

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Пограничные сценарии и устойчивость (Priority: P2)

**Goal**: Корректно обрабатывать отсутствие кандидатов, дневной лимит и race conditions.

**Independent Test**: Проверить сценарии `NO_ELIGIBLE_EVENTS`, `DAILY_LIMIT_REACHED`, double-click на запуске и недоступность ивента после результата.

### Implementation for User Story 3

- [ ] T020 [US3] Обработать `NO_ELIGIBLE_EVENTS` с fallback-экраном/CTA возврата в `events-xakaton-next/src/views/lucky-wheel/index.tsx`.
- [ ] T021 [US3] Обработать `DAILY_LIMIT_REACHED` отдельным UX-сообщением в `events-xakaton-next/src/views/lucky-wheel/index.tsx`.
- [ ] T022 [US3] Добавить защиту от повторных нажатий `Запустить` и отмену/очистку таймеров при unmount в `events-xakaton-next/src/views/lucky-wheel/index.tsx`.
- [ ] T023 [US3] Уточнить серверную аналитику причин отказа (`event.random_open_denied`) в `events-xakaton-nestjs/src/modules/events/handlers/get-random-event.handler.ts`.
- [ ] T024 [US3] Добавить обработку ошибки открытия деталей выбранного ивента (retry/reset) в `events-xakaton-next/src/views/shell/index.tsx`.

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Улучшения, влияющие на несколько user stories

- [ ] T025 [P] Обновить feature-документацию и smoke-notes в `specs/001-lucky-wheel/quickstart.md`.
- [ ] T026 Выполнить линт фронта: `cd /Users/frolov.f/hack2026/events-xakaton-next && npm run lint`.
- [ ] T027 Выполнить линт и тайпчек бэка: `cd /Users/frolov.f/hack2026/events-xakaton-nestjs && npm run lint && npm run typecheck`.
- [ ] T028 Выполнить ручной smoke по `specs/001-lucky-wheel/quickstart.md` и зафиксировать результаты в `specs/001-lucky-wheel/quickstart.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Start after Foundational; независима от US2/US3
- **User Story 2 (P1)**: Start after Foundational; использует backend random policy
- **User Story 3 (P2)**: Start after Foundational; расширяет US2 обработкой ошибок

### Within Each User Story

- Shared constants and endpoint contracts before UI wiring
- UI wiring before analytics polishing
- Story complete before moving to next priority when working solo

### Parallel Opportunities

- T009 и T014 можно делать параллельно (разные файлы/экраны)
- T019 и T023 можно делать параллельно (frontend/backend analytics)
- T026 и T027 можно запускать параллельно

---

## Parallel Example: User Story 2

```bash
Task: "T014 [P] [US2] Создать экран LuckyWheelScreen in events-xakaton-next/src/views/lucky-wheel/index.tsx"
Task: "T015 [US2] Интегрировать экран в shell in events-xakaton-next/src/views/shell/index.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate secret-reveal flow independently

### Incremental Delivery

1. Setup + Foundational
2. Add US1 -> validate
3. Add US2 -> validate wheel flow
4. Add US3 -> validate failures and daily limit
5. Polish, lint, smoke validation

### Parallel Team Strategy

1. Backend dev: T004-T008
2. Frontend dev A: T009-T013
3. Frontend dev B: T014-T022
4. Shared QA: T026-T028

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- Each user story should stay independently testable
- Avoid overlapping edits in the same file in parallel
