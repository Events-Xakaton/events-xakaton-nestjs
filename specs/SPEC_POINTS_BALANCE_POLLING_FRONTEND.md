# Спека (фронтенд): поллинг баланса очков и уровня пользователя

**Папка:** `specs/`
**Статус:** Draft
**Зависит от:** gamification module (реализован), `SPEC_HEADER_RANK.md`

---

## Суть задачи

Очки начисляются асинхронно в ответ на действия пользователя (вступление в клуб, запись на событие,
оставление отзыва и т.д.). Без обновления фронт показывает устаревший баланс и уровень.
Нужно держать данные свежими без WebSocket — через периодический поллинг с умным управлением частотой.

---

## API

**Эндпоинт:** `GET /points/balance`

**Ответ:**

```typescript
interface PointsBalanceRes {
  lifetime: number;         // суммарные очки за всё время (определяет уровень)
  weekly:   number;         // очки за текущую неделю
  monthly:  number;         // очки за текущий месяц
  rank: {
    level:              number;        // 1–10
    title:              string;        // «Новичок», «Исследователь» ...
    label:              string;        // «Ур. 3 · Участник»
    pointsToNextLevel:  number | null; // null на уровне 10
  };
}
```

Таблица уровней для вычисления прогресс-бара (хранить на фронте как константу, не запрашивать):

| Уровень | Название       | minPoints |
|---------|---------------|-----------|
| 1       | Новичок        | 0         |
| 2       | Исследователь  | 15        |
| 3       | Участник       | 40        |
| 4       | Тусовщик       | 90        |
| 5       | Завсегдатай    | 170       |
| 6       | Организатор    | 290       |
| 7       | Коннектор      | 450       |
| 8       | Амбассадор     | 660       |
| 9       | Легенда        | 940       |
| 10      | Гуру           | 1300      |

`progressPercent = pointsToNextLevel !== null`
`  ? (1 - pointsToNextLevel / (nextLevelMin - currentLevelMin)) * 100`
`  : 100`

---

## Стратегия поллинга

### Базовый интервал

**30 секунд** — достаточно быстро для ощущения «живых» данных, не перегружает бэкенд.

### Умная пауза при неактивности

Если вкладка браузера скрыта (`document.visibilityState === 'hidden'`) — поллинг приостанавливается.
Возобновляется сразу при возврате на вкладку (`visibilitychange` → `'visible'`) с немедленным запросом.

RTK Query `pollingInterval` + `skipPollingIfUnfocused: true` реализуют это автоматически.

### Принудительный рефетч после действий

После любого действия, которое гарантированно начисляет очки, делается немедленный инвалидирующий
рефетч баланса — не ждать 30 секунд:

| Действие | Очки |
|---|---|
| Вступление в клуб | +3 |
| Создание клуба | +10 |
| Запись на событие | +1 |
| Создание события | +8 |
| Оставить отзыв | +4 |
| Первая запись на событие | +? (bonus) |
| Первый аватар (profile_complete) | +? (bonus) |

Рефетч выполняется через `invalidatesTags(['PointsBalance'])` в мутациях RTK Query или вызовом
`dispatch(pointsApi.util.invalidateTags(['PointsBalance']))` после успешной мутации.

---

## Обнаружение нового уровня (level-up)

При каждом обновлении данных сравниваем новый `rank.level` с предыдущим значением из стора.
Если `newLevel > prevLevel` — показываем уведомление о повышении уровня.

```typescript
// В useEffect после получения свежих данных:
if (prevLevel !== undefined && data.rank.level > prevLevel) {
  showLevelUpToast(data.rank);  // см. раздел «Level-up уведомление»
}
```

Предыдущий уровень хранится в Redux store (или `useRef` внутри хука) — не в localStorage,
так как актуален только в рамках сессии.

---

## Level-up уведомление

Показывается toast/snackbar снизу экрана при обнаружении нового уровня:

```
🎉  Новый уровень!
    Ур. {level} · {title}
    [опционально: анимированный значок ранга]
```

- Автоскрытие через 4 секунды.
- Не блокирует интерфейс (не модальное окно).
- Если пользователь поднялся сразу на 2+ уровня (например, был офлайн) — показывать только финальный уровень.

---

## RTK Query

```typescript
// shared/api/points.api.ts
export const pointsApi = createApi({
  reducerPath: 'pointsApi',
  baseQuery: fetchBaseQuery({ ... }),
  tagTypes: ['PointsBalance'],
  endpoints: (builder) => ({

    getBalance: builder.query<PointsBalanceRes, void>({
      query: () => '/points/balance',
      providesTags: ['PointsBalance'],
    }),

  }),
});

export const { useGetBalanceQuery } = pointsApi;
```

Подключение поллинга в хуке:

```typescript
// features/points/lib/usePointsBalance.ts
export function usePointsBalance() {
  const { data, isLoading } = useGetBalanceQuery(undefined, {
    pollingInterval: 30_000,         // 30 секунд
    skipPollingIfUnfocused: true,    // пауза на скрытой вкладке
  });

  const prevLevelRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!data) return;
    if (prevLevelRef.current !== undefined && data.rank.level > prevLevelRef.current) {
      showLevelUpToast(data.rank);
    }
    prevLevelRef.current = data.rank.level;
  }, [data?.rank.level]);

  return { data, isLoading };
}
```

Инвалидация после мутаций (пример для join события):

```typescript
// features/events/api/events.api.ts
joinEvent: builder.mutation<void, string>({
  query: (eventId) => ({ url: `/events/${eventId}/join`, method: 'POST' }),
  invalidatesTags: ['PointsBalance'],   // <-- немедленный рефетч баланса
}),
```

---

## Структура файлов

```
src/
  shared/
    api/
      points.api.ts           # RTK Query эндпоинты + тег PointsBalance
    constants/
      ranks.ts                 # копия таблицы RANKS (синхронизировать с бэком при изменениях)
  features/
    points/
      lib/
        usePointsBalance.ts    # хук: поллинг + level-up detection
        computeProgress.ts     # вычисление progressPercent
      ui/
        LevelUpToast.tsx       # уведомление о новом уровне
      index.ts
```

---

## Где используется `usePointsBalance`

| Компонент | Что отображает |
|---|---|
| Хедер приложения | `rank.label`, прогресс-бар (`SPEC_HEADER_RANK.md`) |
| Страница профиля | Полный блок: очки lifetime/weekly/monthly, ранг, прогресс |
| Страница события | Проверка `rank.level >= event.minLevel` для состояния кнопки «Записаться» |
| Страница Lucky Wheel | Уровень пользователя рядом с его аватаром |

Хук монтируется **один раз** в корневом layout (или глобальном провайдере) — поллинг работает
единственный экземпляр. Дочерние компоненты читают данные через `useGetBalanceQuery()` (кэш RTK Query,
без лишних запросов).

---

## Граничные случаи

| Ситуация | Поведение |
|---|---|
| Пользователь не авторизован | Запрос не делается (`skip: !isAuthorized`) |
| Бэкенд вернул ошибку | Показываем старые данные из кэша, не сбрасываем уровень |
| Пользователь на уровне 10 | `pointsToNextLevel === null`, прогресс-бар = 100%, level-up не показывается |
| Вкладка скрыта 10 минут → пользователь вернулся | Немедленный запрос при `visibilitychange` |
| Мутация вернула ошибку | `invalidatesTags` не вызывается — баланс не рефетчится (ошибка → очки не начислены) |

---

## Что НЕ входит в эту задачу

- История начислений (`GET /points/history`) — отдельный компонент на странице профиля.
- Анимация прогресс-бара при изменении — можно добавить поверх этой спеки.
- Push-уведомление о повышении уровня через Telegram — отдельная задача на бэкенде.
