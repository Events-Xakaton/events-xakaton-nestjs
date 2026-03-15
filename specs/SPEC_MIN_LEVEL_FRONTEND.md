# Спека: ценз уровня события — интеграция на фронтенде

## Контекст

Бэкенд уже возвращает поле `minLevel: number | null` во всех ответах, связанных с событиями.
Фронту нужно показывать ценз там, где пользователь видит событие, и блокировать запись, если уровень не подходит.

---

## Затронутые поверхности

| Поверхность | Что делать |
|---|---|
| Карточка события в общем списке | иконка-замок + уровень |
| Карточка события в списке клуба | то же самое |
| Страница события (детали) | бейдж ценза + состояние кнопки «Записаться» |
| Форма создания события | селектор уровня |
| Форма редактирования события | селектор уровня с возможностью сбросить |

---

## API

Все три ответа уже содержат поле:

```typescript
minLevel: number | null   // 1–10 или null (без ограничений)
```

**`GET /events`** → `EventListItem[]`
**`GET /events/:id`** → `EventDetail`
**`GET /clubs/:id/events`** → `ClubEventsPage` (items: `ClubEventItem[]`)

**`POST /events`** — тело запроса:
```typescript
{ ..., minLevel?: number }        // 1–10, опционально
```

**`PATCH /events/:id`** — тело запроса:
```typescript
{ ..., minLevel?: number | null } // null — снять ограничение
```

**`POST /events/:id/join`** — если уровень недостаточен, бэкенд вернёт:
```json
{ "statusCode": 403, "message": "Для записи на это событие нужен уровень 4 · Тусовщик" }
```

Уровень текущего пользователя доступен через уже существующий запрос:
```
GET /points/balance → { rank: { level: number, title: string, label: string, ... } }
```

---

## 1. Переиспользуемый компонент `MinLevelBadge`

```
shared/ui/min-level-badge/
  MinLevelBadge.tsx
  index.ts
```

### Props

```typescript
interface MinLevelBadgeProps {
  minLevel: number;           // всегда число, null-guard снаружи
  userLevel?: number;         // если передан — цвет меняется по доступности
  className?: string;
}
```

### Внешний вид

```
┌──────────────────┐
│  🔒 от Ур. 4     │   ← если userLevel не передан или userLevel >= minLevel
└──────────────────┘

┌──────────────────┐
│  🔒 от Ур. 4     │   ← если userLevel < minLevel: красный фон/текст
└──────────────────┘
```

Tailwind:
- Доступно (или неизвестно): `bg-indigo-50 text-indigo-700 border border-indigo-200`
- Недоступно: `bg-red-50 text-red-600 border border-red-200`
- Размер: `text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1`
- Иконка замка: `🔒` или `<LockClosedIcon className="w-3 h-3" />` (Heroicons)

Текст: `«от Ур. N · Название»`, где название берётся из статической таблицы `RANKS` по уровню.

```typescript
// shared/constants/ranks.ts
// RANKS уже есть — просто импортировать
const rankTitle = RANKS.find(r => r.level === minLevel)?.title ?? '';
// → "от Ур. 4 · Тусовщик"
```

---

## 2. Карточка события в общем списке (`EventCard`)

**Данные:** `EventListItem.minLevel`

### Где разместить

В карточке, рядом с `freeSpots` (количество мест):

```
┌────────────────────────────────────────────┐
│  [Обложка]                                 │
│  Hackathon Spring 2026          upcoming   │
│  15 мар, 10:00                             │
│  👥 40 / 100 мест   🔒 от Ур. 4 · Тусовщик │
└────────────────────────────────────────────┘
```

### Требования

- Показывать `<MinLevelBadge minLevel={event.minLevel} userLevel={userRank?.level} />` только если `event.minLevel !== null`.
- `userRank` берётся из кэша RTK Query `getPointsBalance` — запрос уже выполняется для шапки, данные доступны без дополнительного fetch.
- Если уровень недостаточен — бейдж красный, но карточка кликабельна (пользователь может зайти и прочитать описание).

---

## 3. Карточка события в списке клуба (`ClubEventCard`)

**Данные:** `ClubEventItem.minLevel`

Аналогично п. 2 — тот же `<MinLevelBadge />` рядом с количеством мест.

---

## 4. Страница события — детали (`EventDetailPage`)

**Данные:** `EventDetail.minLevel`

### Бейдж в блоке метаданных

Добавить строку в секцию с деталями события (рядом с местом проведения, датами, количеством мест):

```
📍 Digital October, Берсеневская набережная 6с3
📅 21 мар 2026, 10:00 – 18:00
👥 40 / 100 мест
🔒 Минимальный уровень: Ур. 4 · Тусовщик   ← новая строка, только если minLevel !== null
```

### Кнопка «Записаться»

Логика определяется **на клиенте** (не ждать ошибки 403 от сервера):

```typescript
const userLevel   = pointsBalance?.rank?.level ?? 1;
const canJoin     = event.minLevel === null || userLevel >= event.minLevel;
const isJoined    = event.joinedByMe;
const hasSpots    = event.freeSpots === null || event.freeSpots > 0;
const isActive    = event.status === 'upcoming' || event.status === 'ongoing';
```

| Условие | Состояние кнопки | Текст |
|---|---|---|
| `isJoined` | вторичная / деструктивная | «Отменить запись» |
| `!isActive` | disabled | «Запись закрыта» |
| `!hasSpots` | disabled | «Мест нет» |
| `!canJoin` | disabled + tooltip | «Нужен Ур. N · Название» |
| иначе | primary, активна | «Записаться» |

**Tooltip при `!canJoin`:**
```
Для записи нужен уровень N · Название.
Ваш уровень: M · Название.
```

Tooltip показывается по `hover` / `long press` (для mobile).

> Даже если клиент пропустит проверку — бэкенд вернёт 403, и нужно показать toast с текстом из `error.message`.

---

## 5. Форма создания события

**Эндпоинт:** `POST /events`
**Поле:** `minLevel?: number` (1–10, опционально)

### UI-компонент селектора

```
shared/ui/level-select/
  LevelSelect.tsx
  index.ts
```

```typescript
interface LevelSelectProps {
  value: number | null;
  onChange: (level: number | null) => void;
  label?: string;
}
```

**Визуальное решение — сегментированный список или select:**

```
Минимальный уровень участников:
┌────────────────────────────────────────────────────────┐
│  Без ограничений  │ Ур.2 │ Ур.3 │ Ур.4 │ ... │ Ур.10  │
└────────────────────────────────────────────────────────┘
```

Или `<select>` с опциями:
```
— Без ограничений —
Ур. 1 · Новичок
Ур. 2 · Исследователь
...
Ур. 10 · Гуру
```

Опции генерируются из статической таблицы `RANKS`.

**Поведение:**
- По умолчанию: «Без ограничений» (`null`).
- При выборе уровня — показать подсказку: «Участники ниже этого уровня не смогут записаться».
- Отправлять `minLevel` только если выбрано значение ≠ null; если null — не включать поле в тело запроса (бэкенд примет отсутствующее поле как `undefined` → без ограничений).

---

## 6. Форма редактирования события

**Эндпоинт:** `PATCH /events/:id`
**Поле:** `minLevel?: number | null`

Тот же компонент `<LevelSelect />` с двумя отличиями:

1. **Начальное значение** берётся из `EventDetail.minLevel` — предзаполнить селектор.
2. **Снятие ограничения** — при выборе «Без ограничений» отправлять `minLevel: null` явно (не пропускать поле), чтобы бэкенд сбросил существующее значение.

```typescript
// Логика формирования patch-тела:
const patch: UpdateEventDto = {};
if (form.minLevel !== initialEvent.minLevel) {
  patch.minLevel = form.minLevel; // number или null
}
```

---

## 7. Что ты пропустил — дополнительные поверхности

### 7.1 Страница «Случайное событие» (Lucky Wheel)

Lucky Wheel — особый сценарий: пользователь получает случайное событие **вне зависимости от своего уровня**. Ценз намеренно игнорируется, это игровая механика.

**Как это работает на бэке:**
- `POST /events/:eventId/join?lucky=true` — бэкенд проверяет, что у пользователя есть `LuckyWheelUsage` за сегодня, и если да — пропускает проверку `minLevel`.

**Что делает фронт:**
- Кнопка «Записаться» на странице события, открытой через Lucky Wheel, вызывает `/join?lucky=true`.
- Хук `useCanJoin` **не используется** для этой кнопки — вместо него всегда активная кнопка «Мне повезло, записаться».
- Бейдж `<MinLevelBadge />` всё равно отображается (для информации), но не влияет на состояние кнопки.
- Если бэкенд вернёт 403 (например, `LuckyWheelUsage` не найден — пользователь не использовал колесо сегодня), показать toast: «Для использования Lucky Join сначала открой случайное событие».

### 7.2 Уведомления об изменении события

Бэкенд **уже реализован**: при изменении `minLevel` организатором участники получают уведомление типа `event_changed` с текстом:
- «Новый ценз уровня: **Ур. 4**» — если установлен
- «Новый ценз уровня: **снят (открыто для всех)**» — если убран

Фронту ничего делать не нужно — тап по уведомлению ведёт на страницу события, где бейдж уже будет корректным.

### 7.3 Шаринг / превью события

Если в приложении есть экран шаринга события (например, для пересылки ссылки в Telegram), включить в превью строчку «🔒 от Ур. N», если `minLevel !== null`.

### 7.4 Фильтрация списка событий

В будущем (сейчас нет на бэке) — фильтр «Доступные мне», который скрывает события с `minLevel > userLevel`. Фронт **не должен** реализовывать это самостоятельно через клиентскую фильтрацию, так как список уже пагинирован на бэке. Это задача для отдельного query-параметра бэка.

---

## Размещение в FSD

```
shared/
  ui/
    min-level-badge/
      MinLevelBadge.tsx        # бейдж «🔒 от Ур. N»
      index.ts
    level-select/
      LevelSelect.tsx          # селектор уровня для форм
      index.ts
  constants/
    ranks.ts                   # RANKS — статическая таблица (уже должна быть из SPEC_HEADER_RANK.md)

features/
  join-event/
    model/
      useCanJoin.ts            # хук: вычисляет canJoin, tooltipText из event + userLevel
```

### Хук `useCanJoin`

```typescript
// features/join-event/model/useCanJoin.ts
import { useGetPointsBalanceQuery } from '@/shared/api/gamification.api';

interface UseCanJoinOptions {
  /** true — сценарий Lucky Wheel, ценз уровня игнорируется */
  lucky?: boolean;
}

export function useCanJoin(
  event: { minLevel: number | null; freeSpots: number | null; status: string; joinedByMe: boolean },
  options: UseCanJoinOptions = {},
) {
  const { data: balance } = useGetPointsBalanceQuery();
  const userLevel = balance?.rank?.level ?? 1;

  const isActive   = event.status === 'upcoming' || event.status === 'ongoing';
  const hasSpots   = event.freeSpots === null || event.freeSpots > 0;
  // Lucky Wheel обходит проверку уровня
  const meetsLevel = options.lucky || event.minLevel === null || userLevel >= event.minLevel;

  const blockReason: string | null =
    event.joinedByMe ? null :
    !isActive        ? 'Запись закрыта' :
    !hasSpots        ? 'Мест нет' :
    !meetsLevel      ? `Нужен Ур. ${event.minLevel}` :
    null;

  return {
    canJoin:     !event.joinedByMe && isActive && hasSpots && meetsLevel,
    blockReason,
    userLevel,
    /** Передать в API-запрос: POST /events/:id/join?lucky=true */
    joinQueryParams: options.lucky ? { lucky: 'true' } : {},
  };
}
```

---

## Состояния скелетона

Для `MinLevelBadge` в картах при загрузке — маленький серый прямоугольник `animate-pulse w-24 h-4 rounded-full`.
