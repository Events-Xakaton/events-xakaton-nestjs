# Data Model: Lucky Wheel for Events

## 1) LuckyDailyQuota (server-side, persistent)
- Purpose: Ограничение "не более 1 запуска механики в календарный день UTC".
- Storage: отдельная таблица `lucky_wheel_usage`.
- Fields:
  - `id` (uuid)
  - `userId` (uuid, FK -> user)
  - `dayKey` (string, формат `YYYY-MM-DD` в UTC)
  - `usedAtUtc` (datetime)
- Constraints:
  - Unique `(userId, dayKey)`.
- State:
  - `available` -> `used` (после успешного запуска/выбора).

## 2) LuckyCandidateEvent (query projection)
- Purpose: Кандидат для random-выбора.
- Fields:
  - `eventId` (uuid)
  - `startsAtUtc` (datetime)
  - `statusComputed` (`upcoming` only)
  - `joinedByMe` (bool, must be false)
  - `freeSpots` (number | null, must be `>0` when not null)
- Rules:
  - Исключать `cancelled`, `past`, `ongoing`.
  - Исключать creator/joined participations.
  - Исключать full events при `maxParticipants`.

## 3) LuckySelectionPolicy (config)
- Purpose: Централизованные параметры выбора.
- Fields:
  - `kNearest = 5`
  - `minViewedEvents = 9`
  - `triggerWindowMs = 3000`
- Rules:
  - If candidates `> kNearest`, sample from first `kNearest` sorted by `startsAtUtc` asc.
  - Else sample from all eligible.

## 4) LuckyTriggerSession (client ephemeral)
- Purpose: Отслеживание быстрого скролла и раскрытия кнопки.
- Fields:
  - `startedAtMs`
  - `viewedEventIds` (set)
  - `revealed` (bool)
- Rules:
  - reveal when `viewedEventIds.size >= 9` within `3000ms`.
  - reset when window elapsed or user leaves Events tab.
