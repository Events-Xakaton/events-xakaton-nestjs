# Tasks: Attendance Confirmation

## Phase 1: Schema + миграция

- [ ] T001 Добавить модель `AttendanceConfirmation` в `src/prisma/schema.prisma`
- [ ] T002 Создать и применить миграцию `add_attendance_confirmation`
- [ ] T003 Регенерировать Prisma Client (`npm run prisma:generate`)

## Phase 2: Command + Handler

- [ ] T004 Создать `src/modules/events/dto/request/confirm-attendance.req.dto.ts` с валидацией `rating` (1–5, optional) и `userId` (UUID)
- [ ] T005 Создать `src/modules/events/commands/confirm-attendance.command.ts`
- [ ] T006 Создать `src/modules/events/handlers/confirm-attendance.handler.ts` с полной бизнес-логикой
- [ ] T007 Добавить экспорты в barrel-файлы (`commands/index.ts`, `handlers/index.ts`, `dto/request/index.ts`)

## Phase 3: Обновление GetEventHandler

- [ ] T008 Добавить `attendanceConfirmed` в запрос и маппинг в `src/modules/events/handlers/get-event.handler.ts`

## Phase 4: Обновление EventDetailResDto

- [ ] T009 Добавить поле `attendanceConfirmed: boolean` в `src/modules/events/dto/response/event-detail.res.dto.ts`

## Phase 5: Контроллер + регистрация

- [ ] T010 Добавить `POST :eventId/attendance` в `src/modules/events/events.controller.ts` со Swagger-аннотациями
- [ ] T011 Зарегистрировать `ConfirmAttendanceHandler` в `src/modules/events/events.module.ts`

## Phase 6: Проверка

- [ ] T012 `npm run typecheck` — без ошибок
- [ ] T013 `npm run lint -- --fix` — без ошибок
- [ ] T014 Обновить `progress.md`
