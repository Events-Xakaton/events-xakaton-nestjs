# Data Model: Attendance Confirmation

## 1) AttendanceConfirmation (server-side, persistent)

- **Purpose**: Хранит факт подтверждения присутствия участника организатором и опциональную оценку.
- **Storage**: Новая таблица `AttendanceConfirmation` в PostgreSQL.
- **Fields**:
  - `eventId` (String, FK → Event, CASCADE DELETE)
  - `userId` (String, FK → User, CASCADE DELETE)
  - `rating` (Int?, 1–5, nullable)
  - `confirmedAt` (DateTime, default now())
- **Constraints**:
  - Composite PK: `(eventId, userId)` — один участник не может быть подтверждён дважды.
  - Index: `(eventId)` — для подсчёта `attendanceConfirmed` в деталях события.

## 2) Изменения в существующих моделях

### EventDetailResDto
- Добавить поле `attendanceConfirmed: boolean`.
- Вычисляется в `GetEventHandler`: `true` если существует хотя бы одна запись `AttendanceConfirmation` для данного `eventId`.

## 3) PointsLedger (существующая, без изменений)

Уникальный индекс `(userId, ruleCode, referenceId)` гарантирует идемпотентность начисления.
При повторной попытке `PointsService.award` с теми же параметрами — запись просто не создастся.

| ruleCode | deltaPoints | referenceId |
|---|---|---|
| `attendance_feedback` | `rating` (1–5) | `eventId` |

## 4) AttendanceBulkReqDto (request)

- `attendances`: массив объектов:
  - `userId`: String (UUID)
  - `rating`: Int (1–5), optional

## 5) Telegram-уведомление (ephemeral, не хранится)

Отправляется через `bot.telegram.sendMessage(telegramUserId, message)`.
`telegramUserId` берётся из `User.telegramUserId` (BigInt → Number).
