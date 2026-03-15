# Спека (фронтенд): кнопка Lucky Wheel в навбаре после активации пасхалки

**Папка:** `specs/`
**Статус:** Draft

---

## Суть задачи

Когда пользователь впервые активирует пасхалку (прокрутил 9 ивентов за 3 секунды), происходит
«разблокировка» Lucky Wheel:

1. Над нав-баром появляется постоянная плавающая кнопка-пилюля «🎰 Крутить колесо» с wow-анимацией.
2. Пасхалка (`EasterEggButton`) **больше не появляется** в последующих сессиях.
3. Мониторинг скролла (`useLuckyTrigger`) **отключается** сразу после разблокировки.
4. Разблокировка сохраняется навсегда через `localStorage` + Telegram Cloud Storage.

Существующее поведение при первом нажатии на яйцо (переход в рулетку) **не меняется**.

---

## UX-сценарии

### Сценарий A — первое открытие (не разблокировано)

1. Shell загружается → `useLuckyTrigger` запускается в обычном режиме.
2. Пользователь прокручивает 9 ивентов за 3 с — яйцо появляется (как сейчас).
3. **Одновременно**: плавающая пилюля влетает снизу над нав-баром (wow-анимация).
4. Флаг `lucky_wheel_unlocked = "1"` пишется в `localStorage` И в Telegram Cloud Storage.
5. Пользователь **нажимает на яйцо** → переход в Lucky Wheel, яйцо скрывается (поведение не меняется).
   Или пользователь **нажимает на пилюлю** → переход в Lucky Wheel.
6. `useLuckyTrigger` отключает оба observer'а немедленно после срабатывания.

### Сценарий B — повторное открытие (уже разблокировано)

1. Shell загружается → читаем флаг из `localStorage` (синхронно) — он есть.
2. `useLuckyTrigger` **не монтируется** (условный рендер).
3. `EasterEggButton` **не рендерится**.
4. Плавающая пилюля отображается сразу (без wow-анимации, просто появляется).

### Сценарий C — localStorage пуст, но CloudStorage имеет флаг

(Возможно при первом запуске на новом устройстве.)

1. Shell загружается → `localStorage` пуст → читаем из Telegram CloudStorage (асинхронно).
2. Пока CloudStorage не ответил: `useLuckyTrigger` работает в штатном режиме, пилюли нет.
3. CloudStorage ответил `"1"` → записываем в `localStorage`, показываем пилюлю (без wow).
4. CloudStorage ответил `""` или ошибка → считаем «не разблокировано».

---

## Хранение флага разблокировки

Ключ: `lucky_wheel_unlocked`
Значение: `"1"` (строка)

### Приоритет чтения

```
localStorage → CloudStorage → «не разблокировано»
```

### Запись (при активации)

Записываем **в оба** хранилища одновременно:

```typescript
localStorage.setItem('lucky_wheel_unlocked', '1');
window.Telegram?.WebApp?.CloudStorage?.setItem(
  'lucky_wheel_unlocked', '1', () => { /* silent */ }
);
```

### Инициализация при загрузке

```typescript
// 1. Синхронная проверка localStorage
const fromLocal = localStorage.getItem('lucky_wheel_unlocked') === '1';

// 2. Если нет — асинхронная проверка CloudStorage
if (!fromLocal) {
  window.Telegram?.WebApp?.CloudStorage?.getItem(
    'lucky_wheel_unlocked',
    (err, value) => {
      if (!err && value === '1') {
        localStorage.setItem('lucky_wheel_unlocked', '1');
        setUnlocked(true);
      }
    }
  );
}
```

---

## Плавающая кнопка-пилюля

### Позиционирование

```
fixed, bottom: calc(nav-bar-height + safe-area-bottom + 12px), left: 50%, transform: translateX(-50%)
z-index: 60 (выше нав-бара z-50, ниже модалок z-1000+)
```

Внешний вид:

```
[ 🎰  Крутить колесо ]
```

- Pill-форма: `rounded-full`
- Градиент: `from-amber-400 to-orange-500`
- Тень: `shadow-xl shadow-orange-400/40`
- Постоянная лёгкая пульсация (glow) после появления: `animation: lucky-glow 2s ease-in-out infinite`

### Wow-анимация появления (только при первой активации)

Последовательность:

1. **0 мс** — яйцо появляется как обычно.
2. **200 мс** — пилюля начинает влетать снизу (`translateY(80px) → translateY(0)`) с `cubic-bezier(0.34, 1.56, 0.64, 1)` (spring-эффект).
3. **400 мс** — конфетти: `confetti({ position: { x: window.innerWidth/2, y: window.innerHeight - 80 }, count: 60, velocity: 180 })` из `@hiseb/confetti`.
4. После завершения появления — переход в режим постоянной пульсации glow.

Wow-анимация **не блокирует** клик на яйцо — яйцо кликабельно немедленно.

```css
@keyframes lucky-pill-enter {
  from { opacity: 0; transform: translateX(-50%) translateY(80px) scale(0.8); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0)    scale(1);   }
}

@keyframes lucky-glow {
  0%, 100% { box-shadow: 0 8px 24px theme('colors.orange.400 / 35%'); }
  50%       { box-shadow: 0 8px 36px theme('colors.orange.400 / 65%'); }
}
```

---

## Исправление производительности `useLuckyTrigger`

**Проблема:** После срабатывания триггера `IntersectionObserver` и `MutationObserver`
остаются подключёнными. `MutationObserver` с `{ subtree: true }` реагирует на каждый
перерендер React внутри feed-контейнера — бесполезная нагрузка.

**Исправление:** Отключать оба observer'а **сразу после** выставления `isTriggered = true`:

```typescript
// В onIntersection, после setIsTriggered(true):
ioRef.current?.disconnect();
moRef.current?.disconnect();
```

Дополнительно: хук `useLuckyTrigger` не монтируется вовсе, если `isUnlocked === true`
(условный рендер на уровне `HomeScreen`).

---

## Структура компонентов

```
src/
  features/
    lucky-wheel-unlock/
      lib/
        useLuckyWheelUnlock.ts    # хук: чтение/запись флага + CloudStorage
      ui/
        LuckyWheelPill.tsx        # кнопка-пилюля
        styles/
          lucky-wheel-pill.css
      index.ts
```

### `useLuckyWheelUnlock`

```typescript
type UseLuckyWheelUnlockResult = {
  isUnlocked: boolean;
  /** Вызвать при активации пасхалки */
  unlock: () => void;
};
```

Внутри:
- `useState(false)` — инициализируется из `localStorage` синхронно
- `useEffect` — при старте читает CloudStorage если localStorage пуст
- `unlock()` — пишет в оба хранилища, ставит `isUnlocked = true`

### `LuckyWheelPill`

```typescript
type Props = {
  isNew: boolean;   // true = первая активация → wow-анимация
  onClick: () => void;
};
```

### Подключение в `HomeScreen`

```tsx
// Заменяет логику передачи isLuckyTriggered:

const { isUnlocked, unlock } = useLuckyWheelUnlock();

// useLuckyTrigger не запускаем если уже разблокировано:
const luckyTrigger = useLuckyTrigger({ disabled: isUnlocked });

// При срабатывании пасхалки:
useEffect(() => {
  if (isLuckyTriggered && !isUnlocked) unlock();
}, [isLuckyTriggered]);

// EasterEggButton рендерим только если не разблокировано:
{!isUnlocked && (
  <EasterEggButton
    visible={isLuckyTriggered && homeTab === 'events'}
    onClick={() => { resetLucky(); onOpenLuckyWheel(); }}
  />
)}
```

### Подключение `LuckyWheelPill` в `MiniAppShell`

Пилюля монтируется в Shell (а не внутри HomeScreen), чтобы оставалась видима
на любом табе и при открытии деталей:

```tsx
// views/shell/index.tsx
{isUnlocked && !luckyWheelOpen && !detail && (
  <LuckyWheelPill
    isNew={isNewUnlock}
    onClick={() => setLuckyWheelOpen(true)}
  />
)}
```

`isNewUnlock` — флаг «только что разблокировалось в эту сессию» (управляется через
callback из `unlock()`), сбрасывается после первого рендера пилюли.

---

## Граничные случаи

| Ситуация | Поведение |
|---|---|
| CloudStorage недоступен (не в TMA) | Silent fail, используем только localStorage |
| Оба хранилища пусты | Пасхалка и триггер работают как обычно |
| Пользователь нажал яйцо до появления пилюли | Переход в рулетку, пилюля появляется после возврата (wow-анимация не показывается повторно) |
| Пользователь открыл детали ивента | Пилюля скрыта (как и нав-бар) |
| `LuckyWheelScreen` открыт | Пилюля скрыта |

---

## Что НЕ входит в эту задачу

- Изменение самого экрана Lucky Wheel.
- Сброс разблокировки (admin/debug функция — отдельная задача).
- Онбординг-тултип «Ты открыл секретную функцию» — можно добавить поверх.
