# Quickstart: Attendance Confirmation

## Preconditions

- Backend запущен локально.
- В БД есть событие в статусе `past` с несколькими joined-участниками.
- Telegram-бот запущен (или в dev-режиме с mock).

## Scenario A: Успешное подтверждение с оценками

1. Получить список участников события через `GET /events/:eventId/participants`.
2. Отправить `POST /events/:eventId/attendance` от имени создателя:
   ```json
   { "attendances": [{ "userId": "...", "rating": 5 }, { "userId": "..." }] }
   ```
3. Ожидаемый ответ: `200 { "status": "ok" }`.
4. Проверить `GET /events/:eventId` → `attendanceConfirmed: true`.
5. Проверить `PointsLedger` в БД — записи с `ruleCode: attendance_feedback`.
6. Проверить уведомление в Telegram-боте у участника с оценкой.

## Scenario B: Повторная отправка

1. Выполнить Scenario A.
2. Повторно отправить тот же запрос.
3. Ожидаемый ответ: `409 Conflict`.

## Scenario C: Защита доступа

1. Отправить запрос от пользователя, который не является создателем.
2. Ожидаемый ответ: `403 Forbidden`.

## Scenario D: Неверный статус события

1. Отправить запрос для события в статусе `upcoming` или `ongoing`.
2. Ожидаемый ответ: `400 Bad Request`.

## Scenario E: userId не участник

1. Включить в список `attendances` userId, который не участвует в событии.
2. Ожидаемый результат: запись игнорируется, остальные подтверждаются, ответ `200`.

## Dev checks

```bash
npm run typecheck
npm run lint -- --fix
```
