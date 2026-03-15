# Спека: шапка приложения с рангом и прогресс-баром

## Контекст

Telegram Mini App (Next.js, App Router, Tailwind CSS, RTK Query, FSD).
Шапка — глобальный компонент, видимый на всех страницах приложения.
Цель: дать пользователю мгновенный фидбэк о его уровне в геймификации.

---

## API

### Эндпоинт

```
GET /points/balance
Headers: x-telegram-init-data: <initData>
```

### Ответ `200 OK`

```typescript
interface PointsBalanceResponse {
  lifetime: number;          // суммарные очки за всё время
  weekly:   number;          // очки за текущую неделю
  monthly:  number;          // очки за текущий месяц
  rank: {
    level:             number;       // 1–10
    title:             string;       // "Новичок" … "Гуру"
    label:             string;       // "Ур. 3 · Участник"
    pointsToNextLevel: number | null; // null на уровне 10
  };
}
```

### Таблица уровней (статическая, для вычисления прогресс-бара)

| level | title        | minPoints |
|-------|--------------|-----------|
| 1     | Новичок      | 0         |
| 2     | Исследователь| 15        |
| 3     | Участник     | 40        |
| 4     | Тусовщик     | 90        |
| 5     | Завсегдатай  | 170       |
| 6     | Организатор  | 290       |
| 7     | Коннектор    | 450       |
| 8     | Амбассадор   | 660       |
| 9     | Легенда      | 940       |
| 10    | Гуру         | 1300      |

---

## Визуальная структура шапки

```
┌─────────────────────────────────────────────────────┐
│  [Аватар]  Имя пользователя          [иконка меню]  │
│            Ур. 3 · Участник                         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  ████████████████░░░░░░░░░░  62 / 90 очков          │
└─────────────────────────────────────────────────────┘
```

Элементы (слева направо, сверху вниз):
1. **Аватар** — круглое фото пользователя (из Telegram), заглушка-инициал если нет
2. **Имя** — `user.fullName` (строка из Telegram initData, доступна в SDK)
3. **Метка ранга** — `rank.label` («Ур. 3 · Участник»), под именем
4. **Прогресс-бар** — горизонтальная полоса заполненности внутри уровня
5. **Числовой прогресс** — «62 / 90 очков» или «MAX» на уровне 10

---

## Логика прогресс-бара

```
currentLevelMin  = minPoints текущего уровня
nextLevelMin     = minPoints следующего уровня (= lifetime + pointsToNextLevel)
pointsInLevel    = lifetime - currentLevelMin
rangeOfLevel     = nextLevelMin - currentLevelMin
progress         = pointsInLevel / rangeOfLevel   // 0.0 … 1.0
```

Пример для lifetime = 62, level = 3 (Участник, min=40), next = 90:
```
pointsInLevel = 62 - 40 = 22
rangeOfLevel  = 90 - 40 = 50
progress      = 22 / 50 = 0.44  → 44% заполнения
```

На уровне 10 (`pointsToNextLevel === null`): прогресс = 1.0, показывать «MAX».

Числовая подпись:
- Уровни 1–9: `«${lifetime - currentLevelMin} / ${rangeOfLevel} очков»`
- Уровень 10:  `«MAX»`

> `currentLevelMin` нужно вычислять на фронте из статической таблицы уровней выше,
> т. к. API возвращает только `pointsToNextLevel` (сколько ещё нужно), но не
> `currentLevelMin`. Формула: `currentLevelMin = lifetime - (rangeOfLevel - pointsInLevel)`,
> или проще: жёстко прошить таблицу `RANKS` на фронте.

---

## Состояния компонента

| Состояние | Поведение |
|---|---|
| Загрузка | скелетон: серый прямоугольник вместо метки ранга, серая полоса вместо прогресс-бара |
| Успех | отрисовка по данным выше |
| Ошибка | метка ранга и прогресс-бар скрыты, только аватар и имя |

---

## Технические требования

### Расположение в FSD

```
src/
  widgets/
    app-header/
      ui/
        AppHeader.tsx         # корневой серверный (или клиентский) компонент
        RankBadge.tsx         # метка «Ур. N · Название» + прогресс-бар
        RankProgressBar.tsx   # чистый presentational, принимает progress: number
      model/
        useRankProgress.ts    # хук: вычисляет progress, pointsInLevel, rangeOfLevel
      index.ts
  shared/
    api/
      gamification.api.ts     # RTK Query: getPointsBalance endpoint
    constants/
      ranks.ts                # статическая таблица RANKS (скопировать с бэкенда)
```

### RTK Query

```typescript
// shared/api/gamification.api.ts
export const gamificationApi = createApi({
  reducerPath: 'gamificationApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  endpoints: (builder) => ({
    getPointsBalance: builder.query<PointsBalanceResponse, void>({
      query: () => 'points/balance',
    }),
  }),
});

export const { useGetPointsBalanceQuery } = gamificationApi;
```

Заголовок `x-telegram-init-data` должен подставляться глобальным `prepareHeaders` в `baseQuery`.

### Пример хука

```typescript
// widgets/app-header/model/useRankProgress.ts
import { RANKS } from '@/shared/constants/ranks';
import { useGetPointsBalanceQuery } from '@/shared/api/gamification.api';

export function useRankProgress() {
  const { data, isLoading, isError } = useGetPointsBalanceQuery();

  if (!data) return { isLoading, isError, progress: 0, label: '', detail: '' };

  const { lifetime, rank } = data;
  const currentRank = RANKS.find((r) => r.level === rank.level)!;
  const nextRank    = RANKS.find((r) => r.level === rank.level + 1) ?? null;

  const pointsInLevel = lifetime - currentRank.minPoints;
  const rangeOfLevel  = nextRank ? nextRank.minPoints - currentRank.minPoints : 1;
  const progress      = nextRank ? pointsInLevel / rangeOfLevel : 1;
  const detail        = nextRank
    ? `${pointsInLevel} / ${rangeOfLevel} очков`
    : 'MAX';

  return { isLoading, isError, progress, label: rank.label, detail };
}
```

---

## Дизайн-заметки

- Прогресс-бар: высота 6–8 px, скруглённые края (`rounded-full`), цвет заполнения — акцентный (например `bg-indigo-500`), фон — `bg-neutral-200 dark:bg-neutral-700`.
- Метка ранга: мелкий текст (`text-xs` или `text-sm`), приглушённый цвет (`text-muted-foreground`).
- Анимация заполнения: `transition-all duration-500 ease-out` при смене значения.
- Скелетон прогресс-бара: `animate-pulse bg-neutral-200`.
- Компонент `RankProgressBar` должен принимать только `progress: number` (0–1) и не знать об API — это позволяет тестировать его изолированно.
