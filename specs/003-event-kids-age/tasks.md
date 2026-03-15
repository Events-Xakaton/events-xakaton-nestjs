# Tasks: Kids Audience Metadata for Events API

**Input**: Design documents from `/specs/003-event-kids-age/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Автотесты явно не обязательны; фокус на реализацию, контракт и smoke.

**Organization**: Tasks are grouped by user story to preserve independent delivery slices.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel
- **[Story]**: User story mapping (`US1`, `US2`, `US3`)

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 Добавить поля `isForKids` и `kidsMinAge` в `src/prisma/schema.prisma` для модели `Event`.
- [ ] T002 Создать Prisma migration для новых колонок в `src/prisma/migrations/` (generated files).
- [ ] T003 Регенерировать Prisma Client (команда `npm run prisma:generate`).

---

## Phase 2: Foundational (Blocking Prerequisites)

- [ ] T004 Обновить DTO создания: `src/modules/events/dto/request/create-event.req.dto.ts`.
- [ ] T005 Обновить DTO редактирования: `src/modules/events/dto/request/update-event.req.dto.ts`.
- [ ] T006 Реализовать запись новых полей в `src/modules/events/handlers/create-event.handler.ts`.
- [ ] T007 Реализовать update-нормализацию `isForKids=false => kidsMinAge=null` в `src/modules/events/handlers/update-event.handler.ts`.

**Checkpoint**: foundation закрывает write-path для user stories.

---

## Phase 3: User Story 1 - Create event audience metadata (Priority: P1) 🎯 MVP

**Goal**: Корректно сохранять взрослые и детские ивенты при создании.

**Independent Test**: create `adult`, `kids(6+)`, `kids(no-age)` и проверка persisted значений.

- [ ] T008 [US1] Уточнить Swagger-описания новых полей в `src/modules/events/dto/request/create-event.req.dto.ts`.
- [ ] T009 [US1] Проверить дефолтное поведение при отсутствии полей в `src/modules/events/handlers/create-event.handler.ts`.
- [ ] T010 [US1] Обновить API-контракт create в `specs/003-event-kids-age/contracts/event-kids-audience.yaml`.

**Checkpoint**: US1 независима и проверяема.

---

## Phase 4: User Story 2 - Update audience metadata (Priority: P1)

**Goal**: Редактировать и сбрасывать детские поля без неконсистентных состояний.

**Independent Test**: `false/null -> true/6 -> true/null -> false/null`.

- [ ] T011 [US2] Обновить Swagger и patch-семантику в `src/modules/events/dto/request/update-event.req.dto.ts`.
- [ ] T012 [US2] Поддержать смену возраста и сброс в `src/modules/events/handlers/update-event.handler.ts`.
- [ ] T013 [US2] Проверить, что изменения детей не ломают текущую очередь уведомлений в `src/modules/events/handlers/update-event.handler.ts`.

**Checkpoint**: US1 + US2 функциональны независимо.

---

## Phase 5: User Story 3 - Read contracts for cards/details (Priority: P1)

**Goal**: Отдавать поля в list/detail/club-list ответах для frontend-карточек и деталей.

**Independent Test**: проверить наличие полей в `GET /events`, `GET /events/:id`, `GET /clubs/:clubId/events`.

- [ ] T014 [US3] Добавить поля в response DTO `src/modules/events/dto/response/event-list-item.res.dto.ts`.
- [ ] T015 [US3] Добавить поля в response DTO `src/modules/events/dto/response/event-detail.res.dto.ts`.
- [ ] T016 [US3] Добавить поля в response DTO `src/modules/clubs/dto/response/club-event-item.res.dto.ts`.
- [ ] T017 [US3] Промапить поля в `src/modules/events/handlers/list-events.handler.ts`.
- [ ] T018 [US3] Промапить поля в `src/modules/events/handlers/get-event.handler.ts`.
- [ ] T019 [US3] Промапить поля в `src/modules/clubs/handlers/list-club-events.handler.ts`.
- [ ] T020 [US3] Обновить read-контракт в `specs/003-event-kids-age/contracts/event-kids-audience.yaml`.

**Checkpoint**: все user stories покрыты.

---

## Phase 6: Polish & Validation

- [ ] T021 Обновить smoke-заметки в `specs/003-event-kids-age/quickstart.md` по факту реализации.
- [ ] T022 Запустить `npm run typecheck` в `/Users/frolov.f/hack2026/events-xakaton-nestjs`.
- [ ] T023 Запустить `npm run lint -- --fix` в `/Users/frolov.f/hack2026/events-xakaton-nestjs`.
- [ ] T024 Проверить end-to-end сценарии из `specs/003-event-kids-age/quickstart.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup -> Foundational -> User Stories -> Polish.

### User Story Dependencies

- US1 зависит от migration и create DTO/handler.
- US2 зависит от update DTO/handler (Foundation).
- US3 зависит от готовой схемы и write-path (для корректных данных в read).

### Parallel Opportunities

- T004 и T005 можно делать параллельно.
- T014, T015, T016 можно делать параллельно.
- T017, T018, T019 можно выполнять параллельно после DTO.

## Notes

- Фича не меняет бизнес-правила join/unjoin.
- Основной риск: разъехавшаяся логика между write-normalization и read-mapping.
