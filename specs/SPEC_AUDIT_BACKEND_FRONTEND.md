# Аудит: контроллеры бэка vs запросы фронта + проверка требований

**Дата:** 2026-03-15
**Статус:** Findings + Action Items

---

## 1. Сводка по всем эндпоинтам

### Events module

| Бэкенд эндпоинт | Фронт вызывает? | Статус |
|---|---|---|
| `GET /events` | ✅ `eventApi.events` | OK |
| `GET /events/random` | ✅ `eventApi.randomEvent` | OK |
| `GET /events/lucky-wheel/streak` | ✅ `eventApi.luckyWheelStreak` | ⚠️ тип устарел (см. п. 3.2) |
| `GET /events/:id` | ✅ `eventApi.eventDetails` | OK |
| `GET /events/:id/participants` | ✅ `eventApi.eventParticipants` | ⚠️ нет поля `rating` (см. п. 4) |
| `POST /events` | ✅ `eventApi.createEvent` | OK |
| `POST /events/:id/join?lucky=` | ✅ `eventApi.joinEvent` | OK |
| `POST /events/:id/unjoin` | ✅ `eventApi.unjoinEvent` | OK |
| `POST /events/:id/feedback` | ✅ `eventApi.submitAttendanceFeedback` | OK |
| `PATCH /events/:id` | ✅ `eventApi.updateEvent` | OK |
| `POST /events/:id/attendance` | ❌ **НЕТ вызова на фронте** | ❌ ПРОБЕЛ |
| `POST /events/:id/cancel` | ✅ `eventApi.cancelEvent` | OK |

### Clubs module

| Бэкенд эндпоинт | Фронт вызывает? | Статус |
|---|---|---|
| `GET /clubs` | ✅ | OK |
| `GET /clubs/meta/event-authoring` | ✅ | OK |
| `GET /clubs/:id` | ✅ | OK |
| `GET /clubs/:id/members` | ✅ | OK |
| `GET /clubs/:id/events` | ✅ | OK |
| `POST /clubs` | ✅ | OK |
| `POST /clubs/:id/join` | ✅ | OK |
| `POST /clubs/:id/leave` | ✅ | OK |
| `PATCH /clubs/:id` | ✅ | OK |
| `DELETE /clubs/:id` | ✅ | OK |

### Gamification module

| Бэкенд эндпоинт | Фронт вызывает? | Статус |
|---|---|---|
| `GET /points/rules` | ✅ `gamificationApi.pointsRules` | OK |
| `GET /points/history` | ✅ `gamificationApi.pointsHistory` | OK |
| `GET /points/balance` | ✅ `gamificationApi.balance` | OK |
| `GET /leaderboard` | ✅ `gamificationApi.leaderboard` | OK |

### Прочие модули (notifications, comments, connections, auth)

Все эндпоинты вызываются на фронте — расхождений нет.

---

## 2. Проверка требования: фри-спины только после пасхалки

### Текущее состояние

**Бэкенд**: понятие «пасхалка» отсутствует. `GET /events/lucky-wheel/streak` доступен
любому авторизованному пользователю — бэкенд не знает, открыл ли пользователь пасхалку.

**Фронт**:
- `LuckyWheelScreen` открывается только если `isUnlocked === true` в shell —
  то есть пасхалка уже сработала. ✅
- `LuckyWheelPill` (floating кнопка) отображается только при `isUnlocked === true`. ✅
- Но `LoginStreakModal` (серия входов → фри-спин) по спеке `SPEC_LOGIN_STREAK_FRONTEND.md`
  показывается **всем пользователям каждый день** — это противоречит требованию.

### Вывод

❌ **Пробел**: `LoginStreakModal` нарушает требование — показывает информацию о фри-спинах
пользователям, которые ещё не открыли пасхалку.

### Action item

В `useLoginStreakModal` (или в layout) добавить условие:

```typescript
// Показывать модалку только если пасхалка уже активирована
const { isUnlocked } = useLuckyWheelUnlockStatus();
const skip = alreadyShown || !isUnlocked;
const { data } = useGetStreakQuery(undefined, { skip });
```

`isUnlocked` читается из `localStorage` (тот же флаг, что использует shell).
Спека для этого изменения — в конце раздела 2 (`SPEC_AUDIT_BACKEND_FRONTEND.md`).

---

## 3. Проверка требования: рулетка даёт доступ к событиям любого уровня

### Бэкенд — `GET /events/random`

```typescript
// get-random-event.handler.ts строки 68-101
// Фильтр: НЕТ условия по minLevel — выбирает из всех upcoming событий с местами ✅
```

### Бэкенд — `POST /events/:id/join?lucky=true`

```typescript
// join-event.handler.ts строки 79-107
const isLuckyBypass = command.lucky &&
  (await prisma.luckyWheelUsage.findUnique({ where: { userId_weekKey: ... } })) !== null;
// ✅ При lucky=true и наличии записи в luckyWheelUsage — minLevel игнорируется
```

### Фронт

- `useCanJoin({ lucky: true })` — `meetsLevel = true` при `lucky=true`. ✅
- `shell.tsx` открывает EventDetails с `{ fromLuckyWheel: true }`. ✅
- В EventDetails join-кнопка читает `fromLuckyWheel` и передаёт в `joinEvent({ lucky: true })`. ✅

### Вывод

✅ **Требование выполнено полностью.** Цепочка замкнута: random не фильтрует по уровню →
join с lucky снимает ценз → фронт передаёт флаг при переходе из рулетки.

### 3.2 Типы LuckyWheelStreakRes не синхронизированы

Бэкенд возвращает 5 полей, фронт-тип знает только 3:

| Поле | Бэкенд | Фронт тип |
|---|---|---|
| `currentStreak` | ✅ | ✅ |
| `daysUntilFreeSpin` | ✅ | ✅ |
| `freeSpinBalance` | ✅ | ✅ |
| `hasUsedWeeklySpin` | ✅ | ❌ отсутствует |
| `nextWeekKey` | ✅ | ❌ отсутствует |

**Action item**: обновить тип `LuckyWheelStreakRes` в `entities/event/api.ts`:

```typescript
type LuckyWheelStreakRes = {
  currentStreak:     number;
  daysUntilFreeSpin: number;
  freeSpinBalance:   number;
  hasUsedWeeklySpin: boolean;   // ← добавить
  nextWeekKey:       string;    // ← добавить ("YYYY-MM-DD" UTC-пн след. недели)
};
```

---

## 4. Проверка требования: оценки участников организатором

### Бэкенд — `POST /events/:id/attendance`

Реализован полностью: DTO принимает `{ attendances: [{ userId, rating?: 1-5 }] }`,
начисляет `rating` очков каждому участнику. ✅

### Бэкенд — `GET /events/:id/participants`

`EventParticipantResDto` возвращает: `telegramUserId, fullName, avatarUrl, followedByMe, rankInfo`.

❌ **Поля `rating` нет** — организатор не видит, кому уже выставил оценку.
❌ **Поля `attendanceConfirmed` нет** — нельзя узнать, подтверждено ли мероприятие.

### Фронт

❌ Нет API-вызова для `POST /events/:id/attendance`.
❌ Нет UI для выставления звёздочек участникам.
❌ `PersonRow` тип не содержит поля `rating`.
❌ `PeopleList` не отображает оценки.

### Вывод

❌ **Требование не выполнено**. Нужны изменения на бэке и фронте.
Детали — в `SPEC_ATTENDANCE_RATING_BACKEND.md` и `SPEC_ATTENDANCE_RATING_FRONTEND.md`.

---

## 5. Итоговая таблица action items

| # | Компонент | Что делать | Приоритет |
|---|---|---|---|
| 1 | Фронт | `LoginStreakModal`: добавить проверку `isUnlocked` | Высокий |
| 2 | Фронт | Обновить тип `LuckyWheelStreakRes` (2 поля) | Средний |
| 3 | Бэкенд | `EventParticipantResDto`: добавить `rating`, `attendanceConfirmed` | Высокий |
| 4 | Бэкенд | `ListEventParticipantsHandler`: джойнить `AttendanceConfirmation` | Высокий |
| 5 | Фронт | Добавить `confirmAttendance` mutation в `eventApi` | Высокий |
| 6 | Фронт | UI: звёздочки в списке участников прошедшего события | Высокий |
| 7 | Фронт | UI: панель подтверждения для организатора | Высокий |
