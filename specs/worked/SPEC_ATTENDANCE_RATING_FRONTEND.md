# Спека (фронтенд): оценки участников на прошедшем мероприятии

**Папка:** `specs/`
**Статус:** Draft
**Зависит от:** `SPEC_ATTENDANCE_RATING_BACKEND.md`

---

## Суть задачи

На странице **прошедшего события** (статус `past`):
1. **Все пользователи** видят список участников с выставленными звёздочками (если подтверждение состоялось).
2. **Организатор** видит панель для выставления оценок участникам и кнопку «Подтвердить присутствие».
3. После отправки — оценки фиксируются, панель скрывается, список обновляется.

---

## API

### Обновлённый тип `PersonRow`

```typescript
// entities/event/types.ts — дополнить:
type PersonRow = {
  telegramUserId: string;
  fullName: string;
  avatarUrl?: string | null;
  followedByMe: boolean;
  rankInfo?: RankInfo;
  role?: 'owner' | 'admin' | 'event_manager' | 'member';
  rating: number | null;              // ← новое: 1–5 или null
  attendanceConfirmed: boolean;       // ← новое: подтверждено ли присутствие
};
```

### Обновлённый тип `LuckyWheelStreakRes`

```typescript
// entities/event/api.ts — дополнить:
type LuckyWheelStreakRes = {
  currentStreak:     number;
  daysUntilFreeSpin: number;
  freeSpinBalance:   number;
  hasUsedWeeklySpin: boolean;   // ← добавить
  nextWeekKey:       string;    // ← добавить
};
```

### Новая мутация `confirmAttendance`

```typescript
// entities/event/api.ts — добавить:

confirmAttendance: builder.mutation<
  { status: string },
  { eventId: string; attendances: Array<{ userId: string; rating?: number }> }
>({
  query: ({ eventId, attendances }) => ({
    url: `/events/${eventId}/attendance`,
    method: 'POST',
    body: { attendances },
    headers: { 'idempotency-key': crypto.randomUUID() },
  }),
  invalidatesTags: ['FEED'],   // обновит список участников
}),
```

---

## UX-поток

### Все пользователи на прошедшем событии

Список участников показывается в `PeopleList`. Каждый элемент:

```
[ Аватар ]  Имя Фамилия    Ур. 3 · Участник    ★★★★☆   [ Подписаться ]
                                                 ↑
                         если attendanceConfirmed=true и rating !== null
```

- Если `attendanceConfirmed=true` и `rating !== null` → показать заполненные звёздочки.
- Если `attendanceConfirmed=true` и `rating=null` → показать иконку ✓ без звёздочек.
- Если `attendanceConfirmed=false` → ничего не показывать (звёздочки скрыты).

### Организатор на прошедшем событии

Если `event.canManage === true` И `event.status === 'past'`:

1. Проверяем, было ли уже подтверждение:
   - `participants.some(p => p.attendanceConfirmed)` → подтверждение уже было.
   - Показываем `AttendanceAlreadyDoneNotice` («Подтверждение отправлено»).

2. Если подтверждение ещё не было:
   - Показываем `AttendancePanel` над списком участников.

---

## Компонент `AttendancePanel`

```
┌─────────────────────────────────────────────────────────┐
│  ⭐ Подтвердите присутствие и поставьте оценки          │
│  Участники получат очки опыта (1 звезда = 1 очко)       │
├─────────────────────────────────────────────────────────┤
│  [ Аватар ] Алексей Иванов                              │
│             ★ ★ ★ ★ ★   (интерактивные, нажимаемые)   │
│             [   Был   ]  [  Не был  ]    ← переключатель│
├─────────────────────────────────────────────────────────┤
│  [ Аватар ] Мария Петрова                               │
│             ★ ★ ★ ★ ★                                  │
│             [   Был   ]  [  Не был  ]                   │
├─────────────────────────────────────────────────────────┤
│                 [ Подтвердить присутствие ]              │
└─────────────────────────────────────────────────────────┘
```

### Поведение звёздочек

- Нажатие на N-ю звезду → `rating = N` для участника.
- Повторное нажатие на ту же звезду → сброс оценки (`rating = undefined`).
- Если переключатель «Не был» → участник исключается из списка `attendances` (не отправляется).
- По умолчанию все участники в «Был», оценка не выставлена.

### Кнопка «Подтвердить присутствие»

```typescript
// Формируем payload: только те, кто «Был»
const attendances = participants
  .filter(p => presence[p.telegramUserId] !== 'absent')
  .map(p => ({
    userId: p.telegramUserId,   // ← userId (UUID), не telegramUserId
    ...(ratings[p.telegramUserId] ? { rating: ratings[p.telegramUserId] } : {}),
  }));

confirmAttendance({ eventId, attendances });
```

> ⚠️ `userId` в `ConfirmAttendanceReqDto` — UUID пользователя, не telegramUserId.
> Нужно убедиться, что `GET /events/:id/participants` возвращает оба поля,
> или хранить внутренний id отдельно.

### После успешной отправки

- Кнопка исчезает, появляется уведомление «Подтверждение отправлено 🎉».
- Список участников рефетчится (через `invalidatesTags(['FEED'])`).
- Участники видят звёздочки.

---

## Компонент `StarRating` (переиспользуемый)

```tsx
// shared/components/StarRating.tsx
interface StarRatingProps {
  value: number | null;         // текущее значение (1–5 или null)
  onChange?: (v: number | null) => void; // undefined = readonly режим
  size?: 'sm' | 'md';
}
```

- В readonly-режиме (`onChange` отсутствует): рендерит заполненные/пустые звёздочки.
- В интерактивном режиме: нажатие меняет значение, повторное нажатие сбрасывает.
- Цвет: `#FED752` (жёлтый, из палитры Lucky Wheel).

---

## Затронутые файлы и компоненты

```
src/
  entities/
    event/
      api.ts           # добавить confirmAttendance мутацию, обновить LuckyWheelStreakRes
      types.ts         # добавить rating, attendanceConfirmed в PersonRow

  features/
    login-streak/
      lib/
        useLoginStreakModal.ts  # добавить проверку isUnlocked перед показом модалки

  shared/
    components/
      StarRating.tsx    # новый переиспользуемый компонент

  views/
    event-details/
      index.tsx         # показать AttendancePanel для организатора past-событий
      ui/
        AttendancePanel.tsx     # новый: панель оценок для организатора
        AttendanceAlreadyDone.tsx # новый: заглушка если уже подтверждено

  widgets/
    people-list/
      index.tsx         # показывать StarRating (readonly) в PersonRow если есть rating
```

---

## Важные граничные случаи

| Ситуация | Поведение |
|---|---|
| `confirmAttendance` вернул 409 | Показываем «Подтверждение уже было отправлено», скрываем панель |
| `attendances` пустой массив (все «Не были») | Кнопка disabled — нельзя отправить пустой список |
| Участников > 50 (лимит пагинации) | Панель работает только с загруженными участниками — предупреждение не нужно |
| Событие ещё не прошло (status != 'past') | `AttendancePanel` не рендерится |
| Не организатор (`canManage=false`) | `AttendancePanel` не рендерится |

---

## Гейт пасхалки для LoginStreakModal

Дополнение к `SPEC_LOGIN_STREAK_FRONTEND.md`:

```typescript
// features/login-streak/lib/useLoginStreakModal.ts

// Читаем флаг разблокировки из localStorage (тот же ключ, что и в shell):
const isLuckyUnlocked = localStorage.getItem('lucky_wheel_unlocked') === 'true';

const todayUtc = new Date().toISOString().slice(0, 10);
const alreadyShown = localStorage.getItem('streak_modal_shown_day') === todayUtc;

// Пропускаем запрос если пасхалка не активирована или уже показали сегодня
const { data, isSuccess } = useGetStreakQuery(undefined, {
  skip: alreadyShown || !isLuckyUnlocked,
});
```

В shell при активации пасхалки сохранять флаг:
```typescript
// views/shell/index.tsx или views/home/model/use-lucky-trigger.ts
// Когда isTriggered переходит в true в первый раз:
localStorage.setItem('lucky_wheel_unlocked', 'true');
```

---

## Что НЕ входит в эту задачу

- Редактирование уже выставленных оценок — `POST /attendance` однократный (409 при повторе).
- Push-уведомление участнику об оценке — уже реализовано на бэкенде через Telegram.
- Фильтрация/сортировка участников по оценке — вне скоупа.
