# Спека (фронтенд): Lucky Wheel на Pixi.js — полная реализация

**Папка:** `specs/`
**Статус:** Draft
**Зависит от:**
- `SPEC_LOGIN_STREAK_FREE_SPIN_BACKEND.md` (реализован)
- `SPEC_LUCKY_WHEEL_WEEKLY_LIMIT_BACKEND.md` (реализован)
- `SPEC_POINTS_BALANCE_POLLING_FRONTEND.md`

**Референс-реализация (источник):** `C:\Users\tahir\Проекты\pegasus\lucky-wheel-next`
- Основные файлы для портирования:
  - `src/widgets/playable-wheel/ui/pixi-wheel.tsx` — сердце анимации
  - `src/widgets/playable-wheel/ui/application-wrapper.tsx` — инициализация Pixi Application
  - `src/widgets/playable-wheel/ui/playable-wheel.tsx` — обёртка с масштабированием
  - `src/widgets/playable-wheel/lib/functions/` — все 10 draw-функций
  - `src/widgets/playable-wheel/lib/constants/` — размеры, фильтры
  - `src/features/game-sounds/` — система звуков
  - `public/sounds/` — 6 звуковых файлов

---

## Суть задачи

Существующий `LuckyWheelScreen` (SVG-рулетка с 8 секторами, CSS-анимация) заменяется на
Pixi.js-рулетку, идентичную референс-реализации по внешнему виду и физике анимации.

**Изменения относительно референса:**
- Вместо текстовых надписей на секторах — эмодзи
- 12 секторов (как в референсе)
- Рулетка останавливается на **визуально случайном** секторе (не определяется бэком)
- Конфетти (`@hiseb/confetti`) после остановки вместо модального окна с призом
- После конфетти (задержка 1с) — модальное окно «Перейти к событию»
- Нет модального окна с призом (разные механики)
- Интеграция с существующим `shell` через callback `onEventSelected`

---

## Семантика розыгрыша

Рулетка — **визуальное представление** получения доступа к случайному событию.
Конкретное событие уже выбрано бэкендом (`GET /events/random`). Визуальный сектор,
на котором останавливается колесо, не несёт смысловой нагрузки — он случаен.
После остановки пользователь видит модальное окно с предложением перейти к событию
и может **записаться вне зависимости от своего уровня** (lucky bypass).

---

## API

### `GET /events/lucky-wheel/streak`

```typescript
interface LuckyWheelStreakRes {
  currentStreak:    number;   // серия входов
  daysUntilFreeSpin: number;  // дней до след. фри-спина
  freeSpinBalance:  number;   // баланс фри-спинов
  hasUsedWeeklySpin: boolean; // стандартный спин этой недели использован
  nextWeekKey:      string;   // "YYYY-MM-DD" пн след. недели — дата разблокировки
}
```

### `GET /events/random`

```typescript
// Ответ:
interface RandomEventRes {
  id:           string;  // UUID события
  usedFreeSpin: boolean; // был использован фри-спин
}
// Ошибки (404):
// message: "DAILY_LIMIT_REACHED" — недельный лимит и фри-спины кончились
// message: "NO_ELIGIBLE_EVENTS"  — нет подходящих событий
```

### `POST /events/:id/join?lucky=true`

Используется при нажатии "Записаться" после перехода от рулетки.
Параметр `lucky=true` снимает ценз уровня на событие.

---

## UX-поток (полный state machine)

```
INIT
  ↓ GET /events/lucky-wheel/streak
  ├─ hasUsedWeeklySpin=false OR freeSpinBalance>0 → IDLE (колесо активно)
  └─ hasUsedWeeklySpin=true AND freeSpinBalance=0 → LOCKED (таймер)

IDLE
  Пользователь нажимает "Крутить"
  ↓
FETCHING (спиннер поверх колеса)
  ↓ GET /events/random
  ├─ success → получили eventId → SPINNING (колесо стартует)
  ├─ 404 DAILY_LIMIT_REACHED → LOCKED (недельный лимит, пока ничего)
  └─ 404 NO_ELIGIBLE_EVENTS  → NO_EVENTS (пока ничего)

SPINNING
  Колесо вращается (react-spring анимация)
  ↓ onAnimationRest (react-spring callback)
STOPPING (500ms delay, как в референсе)
  ↓
RESULT
  Конфетти (@hiseb/confetti)
  Звук BIG_WIN
  1000ms задержка
  ↓
MODAL_OPEN
  Модальное окно: "Вам досталось событие!" + кнопка "Перейти"
  ↓ клик "Перейти"
  Закрываем LuckyWheelScreen
  Открываем EventDetails с { eventId, fromLuckyWheel: true }

  ↓ клик "Закрыть" / свайп вниз
  IDLE (или LOCKED если баланс опустился)
```

---

## npm-пакеты для добавления

```bash
npm install @pixi/react@^8.0.5 pixi.js@^8.16.0 pixi-filters@^6.1.5
npm install @pixi/sound@^6.0.1
npm install @react-spring/web@^10.0.3
npm install nanoid@^5.1.6
```

> `@hiseb/confetti` уже установлен в проекте ✓

---

## Секторы рулетки (12 эмодзи)

```typescript
export const WHEEL_SEGMENTS = [
  '🎭', // 0
  '🎉', // 1
  '🏆', // 2
  '🎯', // 3
  '🎪', // 4
  '🎲', // 5
  '🎸', // 6
  '🌟', // 7
  '🎊', // 8
  '🎖️', // 9
  '🎁', // 10
  '🔥', // 11
] as const;
```

Тематика: события, активности, победы — соответствует платформе.

---

## Структура файлов

```
src/
  widgets/
    lucky-wheel/
      ui/
        LuckyWheelCanvas.tsx         # обёртка с масштабированием (≈ playable-wheel.tsx)
        PixiWheel.tsx                # Pixi компонент с анимацией (≈ pixi-wheel.tsx)
        ApplicationWrapper.tsx       # инициализация Pixi App (≈ application-wrapper.tsx)
        index.ts
      lib/
        constants/
          wheel-diameter.ts          # WHEEL_DIAMETER = 370
          wheel-radius.ts            # WHEEL_RADIUS = 185
          inner-radius.ts            # INNER_RADIUS = 170.5
          noise-filter.ts
          segments.ts                # WHEEL_SEGMENTS (12 эмодзи)
          index.ts
        functions/
          draw-segments.ts
          draw-pointer.ts
          draw-bg.ts
          draw-bg-border.ts
          draw-shadow.ts
          draw-central-shadow.ts
          draw-central-point-border.ts
          draw-central-point-inner.ts
          create-mask-for-shadow.ts
          index.ts
        hooks/
          use-on-application-unmount.ts
          index.ts
        types/
          won-item.ts               # type WonItem { index: number; uniqId: string }
          index.ts
        index.ts
      index.ts

  features/
    wheel-sounds/
      lib/
        enums/
          sound-type.ts             # enum SoundType (BIG_WIN, FAIL, SPINNING, START)
          index.ts
        index.ts
      model/
        wheel-sounds-context.ts     # React Context
        index.ts
      provider/
        WheelSoundsProvider.tsx     # инициализация через @pixi/sound
        index.ts
      index.ts

  views/
    lucky-wheel/
      index.tsx                     # LuckyWheelScreen (РЕФАКТОРИНГ существующего)
      ui/
        SpinButton.tsx              # кнопка с состояниями
        FreeSpinsCounter.tsx        # баланс фри-спинов
        WeeklyTimer.tsx             # таймер до следующего спина
        EventModal.tsx              # модальное окно "Перейти к событию"
      styles/
        lucky-wheel.css             # обновить (оставить dark-фон)

public/
  sounds/                           # скопировать из pegasus/public/sounds/
    big-win.mp3
    fail.mp3
    spinning.mp3
    start.wav
    win.wav
```

---

## Компонент `PixiWheel` — ключевые детали

### Физика анимации (идентично референсу)

```typescript
// src/widgets/lucky-wheel/ui/PixiWheel.tsx
import { useSpring, useTick } from '@react-spring/web'; // или @pixi/react аналог

const [springValue, api] = useSpring(() => ({
  from: { rotation: INITIAL_ROTATION },    // -π/2
  config: {
    tension: 20,   // жёсткость — НЕ МЕНЯТЬ
    friction: 25,  // трение — НЕ МЕНЯТЬ
    mass: 10,      // масса — НЕ МЕНЯТЬ
  },
  onRest: ({ value }) => {
    setResultRotation(value.rotation);
    setIsAnimating(false);
    setTimeout(() => onAnimationRest(), 500);  // delay как в референсе
  },
}));
```

### Случайная остановка (отличие от референса)

В референсе `wonItem.index` определяет нужный сектор по данным API.
Здесь сектор выбирается случайно на клиенте — бэкенд определяет событие, а не визуальный сектор:

```typescript
// После успешного GET /events/random:
const randomSectorIndex = Math.floor(Math.random() * WHEEL_SEGMENTS.length); // 0–11
setWonItem({ index: randomSectorIndex, uniqId: nanoid() });
```

Вычисление целевого угла остаётся идентичным референсу:
```typescript
useEffect(() => {
  if (wonItem) {
    const oneItemAngle = FULL_ROTATION / WHEEL_SEGMENTS.length;
    const currentAngle = resultRotation % FULL_ROTATION;
    const currentSegmentAngle = oneItemAngle * wonItem.index;
    const targetAngle = firstElementRotation - FULL_ROTATION * 2 - currentSegmentAngle;
    api.start({ rotation: targetAngle });
  }
}, [wonItem]);
```

### Эмодзи вместо текста

В референсе (`pixi-wheel.tsx:73`):
```tsx
<pixiText text={name.toUpperCase()} style={new TextStyle({ ... })} />
```

Здесь:
```tsx
<pixiText
  text={WHEEL_SEGMENTS[index]}     // эмодзи
  rotation={handleGetTextRotation(WHEEL_SEGMENTS.length, index)}
  x={handleGetTextX(rotation)}
  y={handleGetTextY(rotation)}
  style={new TextStyle({
    fontSize: 22,                   // крупнее — эмодзи читается лучше
    fontFamily: 'Apple Color Emoji, Segoe UI Emoji, sans-serif',
  })}
/>
```

### Спиннер поверх колеса в фазе FETCHING

```tsx
// В LuckyWheelCanvas.tsx поверх PixiWheel:
{phase === 'fetching' && (
  <div className="wheel-spinner-overlay">
    <div className="spinner" />
  </div>
)}
```

---

## Система звуков

Порт `src/features/game-sounds/` из референса → `src/features/wheel-sounds/`.

### Упрощённый enum (только нужные звуки)

```typescript
export enum SoundType {
  BIG_WIN,   // остановка — есть событие
  FAIL,      // ошибка / нет событий
  SPINNING,  // вращение (volume: 0.2, speed: 0.7)
  START,     // нажатие кнопки (volume: 0.3, speed: 0.9)
}
```

### Когда воспроизводить

| Момент | Звук |
|---|---|
| Нажатие "Крутить" | `START` |
| Начало вращения (`onAnimationStart`) | `SPINNING` |
| Остановка с событием | `BIG_WIN` |
| Ошибка / нет событий | `FAIL` |

### `WheelSoundsProvider`

Оборачивает `LuckyWheelScreen` в дереве. Инициализирует все 4 звука через `@pixi/sound`:

```tsx
// В views/lucky-wheel/index.tsx или в providers.tsx:
<WheelSoundsProvider>
  <LuckyWheelScreen ... />
</WheelSoundsProvider>
```

---

## Конфетти

```typescript
// После остановки колеса — в onAnimationRest callback:
import confetti from '@hiseb/confetti';

const handleAnimationRest = () => {
  // Звук
  play(SoundType.BIG_WIN);

  // Конфетти
  confetti({
    particleCount: 120,
    spread: 80,
    origin: { y: 0.6 },
    colors: ['#FED752', '#BD800A', '#F6DB93', '#D09119', '#FCF7B7'],
  });

  // Задержка 1с → модальное окно
  setTimeout(() => setPhase('modal_open'), 1000);
};
```

---

## Компонент `EventModal`

```tsx
// src/views/lucky-wheel/ui/EventModal.tsx

interface EventModalProps {
  eventId:       string;
  usedFreeSpin:  boolean;
  onNavigate:    (eventId: string) => void;
  onClose:       () => void;
}
```

### Содержимое

```
┌─────────────────────────────┐
│  🎉 Вам досталось событие!  │
│                             │
│  [название события]         │
│  [дата] · [клуб]            │
│                             │
│  💡 Вы можете записаться    │
│     без ограничений уровня  │
│                             │
│  [  Перейти к событию  ]    │
│  [       Закрыть       ]    │
└─────────────────────────────┘
```

- Данные события берутся из кэша RTK Query (`useEventDetailsQuery(eventId)` — уже должен быть).
  Если не в кэше — показываем skeleton.
- Кнопка «Перейти к событию»:
  ```typescript
  onNavigate(eventId);  // закрыть wheel, открыть EventDetails { eventId, fromLuckyWheel: true }
  ```
- `fromLuckyWheel: true` → в `EventDetails` join-кнопка добавляет `?lucky=true` к запросу.
- Если `usedFreeSpin === true` — дополнительная подпись `«использован фри-спин»`.

---

## Компонент `FreeSpinsCounter`

Отображается над кнопкой «Крутить» когда `freeSpinBalance > 0`:

```
🎰 ×2  фри-спина
```

```tsx
// Если hasUsedWeeklySpin=false — не показываем (есть стандартный спин)
// Если hasUsedWeeklySpin=true и freeSpinBalance>0 — показываем
{hasUsedWeeklySpin && freeSpinBalance > 0 && (
  <FreeSpinsCounter count={freeSpinBalance} />
)}
```

---

## Компонент `WeeklyTimer`

Отображается вместо кнопки «Крутить» когда `hasUsedWeeklySpin=true` И `freeSpinBalance=0`:

```
⏳ До следующего спина:
   2д 14ч 37м
```

```typescript
// src/views/lucky-wheel/ui/WeeklyTimer.tsx

function formatCountdown(nextWeekKey: string): string {
  const target = new Date(nextWeekKey).getTime(); // midnight UTC понедельника
  const diff = Math.max(0, target - Date.now());
  const totalMins = Math.floor(diff / 60_000);
  const days    = Math.floor(totalMins / (60 * 24));
  const hours   = Math.floor((totalMins % (60 * 24)) / 60);
  const minutes = totalMins % 60;
  const parts = [];
  if (days > 0)    parts.push(`${days}д`);
  if (hours > 0)   parts.push(`${hours}ч`);
  parts.push(`${minutes}м`);
  return parts.join(' ');
}

// Обновлять раз в минуту (setInterval 60_000)
```

---

## Рефакторинг `LuckyWheelScreen` (views/lucky-wheel/index.tsx)

Существующий компонент использует SVG-рулетку с 8 секторами и CSS-анимацией.
Нужно заменить только рендер-часть. Логика состояний (SpinPhase), API-хуки,
телеметрия — остаются.

### Изменения

| Было | Стало |
|---|---|
| `<WheelSvg>` (SVG, 8 секторов) | `<LuckyWheelCanvas wonItem={wonItem} onAnimationRest={...} />` |
| CSS-анимация через `transform` | Pixi.js + react-spring (physics) |
| Текст на секторах | Эмодзи |
| Нет звуков | `WheelSoundsProvider` + `@pixi/sound` |
| Нет конфетти | `@hiseb/confetti` в `handleAnimationRest` |
| Результат показывается сразу | Конфетти → 1000ms → `EventModal` |
| Нет счётчика фри-спинов | `FreeSpinsCounter` |
| Нет таймера | `WeeklyTimer` когда locked |
| `SpinPhase`: 7 состояний | Добавить `'modal_open'` |

### Обновлённый запрос streak

Добавить `useLuckyWheelStreakQuery()` — уже есть в `entities/event/api.ts`.
При монтировании компонента — читать `hasUsedWeeklySpin`, `freeSpinBalance`, `nextWeekKey`.

```typescript
const { data: streak } = useLuckyWheelStreakQuery();

const canSpin = !streak?.hasUsedWeeklySpin || (streak?.freeSpinBalance ?? 0) > 0;
```

---

## Интеграция с shell

`LuckyWheelScreen` уже рендерится как overlay в `src/views/shell/index.tsx`.
При нажатии «Перейти к событию» в `EventModal`:

```typescript
// Существующий callback в shell:
onEventSelected(eventId);  // открывает EventDetails с fromLuckyWheel: true
```

В `EventDetails` join-кнопка при `fromLuckyWheel: true` добавляет `?lucky=true`:
```typescript
joinEvent({ eventId, lucky: fromLuckyWheel });
```

Это уже поддерживается в `entities/event/api.ts` и на бэкенде.

---

## Assets для копирования

### Звуки

Скопировать из `pegasus/lucky-wheel-next/public/sounds/` в `events-xakaton-next/public/sounds/`:

| Файл | volume | speed |
|---|---|---|
| `big-win.mp3` | 0.3 | — |
| `fail.mp3` | 0.3 | — |
| `spinning.mp3` | 0.2 | 0.7 |
| `start.wav` | 0.3 | 0.9 |
| `win.wav` | 0.3 | — |

(файлы `error.mp3` не нужен — в нашем приложении при ошибке ничего не показываем)

---

## Граничные случаи

| Ситуация | Поведение |
|---|---|
| `NO_ELIGIBLE_EVENTS` | Фаза остаётся `idle`, кнопка активна (пользователь может попробовать позже) |
| `DAILY_LIMIT_REACHED` | Переход в фазу `locked`, показываем `WeeklyTimer` |
| Пользователь закрыл модалку не перейдя на событие | Фаза → `idle` или `locked` (пересчёт из streak) |
| Анимация завершилась, но `eventId` потерян | Показываем «Что-то пошло не так», кнопка «Закрыть» |
| Pixi не поддерживается (старый WebGL) | Fallback: SVG-рулетка (существующий `WheelSvg`) |
| Пользователь быстро закрывает экран во время вращения | `cleanup()` в useEffect → остановить анимацию, unmount Pixi |

---

## Что НЕ входит в эту задачу

- Изменение механики триггера (`useLuckyTrigger`, `EasterEggButton`) — без изменений.
- Кнопка включения/выключения звука (`SoundToggler`) — добавить можно поверх этой спеки.
- Анимация открытия/закрытия экрана рулетки — текущий overlay без изменений.
- Разные цветовые схемы (`WheelColorSchema`) — используется только YELLOW.