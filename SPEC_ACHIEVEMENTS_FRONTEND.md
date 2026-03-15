# Спека: Ачивки — Frontend

> Статус: актуальная. Условия ачивок зафиксированы.
> Привязка к архитектуре фронта (FSD, RTK Query, Next.js App Router) — уточнить при получении структуры репо.

---

## 1. Общая концепция

- Ачивки — скрытые пасхалки. Пользователь не видит список того, что можно получить.
- Ачивки отображаются в разделе **"Очки"** (gamification/leaderboard screen).
- Иконка активной ачивки заменяет аватар пользователя **везде** в приложении.
- Ачивка выдаётся в момент создания события (и других действий — TBD), сопровождается анимацией и модалкой.

---

## 2. RTK Query: новые эндпоинты

```typescript
// achievements.api.ts (shared/api/ или features/achievements/api/)

const achievementsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({

    // GET /achievements/me — список полученных ачивок пользователя
    getUserAchievements: builder.query<AchievementDto[], void>({
      query: () => '/achievements/me',
      transformResponse: (res: ApiResponse<AchievementDto[]>) => res.data,
      providesTags: ['Achievements'],
    }),

    // POST /achievements/me/active — применить / снять ачивку
    setActiveAchievement: builder.mutation<void, { achievementId: string | null }>({
      query: (body) => ({
        url: '/achievements/me/active',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Achievements', 'UserProfile', 'Leaderboard'],
    }),

  }),
});

export const { useGetUserAchievementsQuery, useSetActiveAchievementMutation } = achievementsApi;
```

### Обновление мутаций с `unlockedAchievements`

Три мутации теперь возвращают `unlockedAchievements`. Обновить типы ответов:

```typescript
// Создать событие
interface CreateEventResponse {
  id: string;
  unlockedAchievements: AchievementDto[];  // "Один дома"
}

// Вступить в событие
interface JoinEventResponse {
  status: 'ok';
  unlockedAchievements: AchievementDto[];  // "Первый мститель"
}

// Подтвердить посещение (вызывает создатель)
interface ConfirmAttendanceResponse {
  status: 'ok';
  unlockedAchievements: AchievementDto[];  // "Уилсон"
}
```

Для каждой мутации добавить обработку `unlockedAchievements` в `onQueryStarted` или в вызывающем компоненте.

### Типы

```typescript
interface AchievementDto {
  id: string;
  code: string;
  name: string;
  description: string;
  iconUrl: string;       // абсолютный URL на бэкенд-статику
  earnedAt: string;      // ISO date string
  isActive: boolean;     // применена ли как аватар
}
```

---

## 3. Аватар: обновление компонента `UserAvatar`

Бэкенд возвращает уже разрешённый `avatarUrl` (если есть активная ачивка — URL иконки, иначе — Telegram-аватар). Компонент `UserAvatar` изменений в логике не требует — просто использует `avatarUrl` из ответа API.

> Проверить: все места, где отображается аватар пользователя, используют единый компонент. Если где-то `avatarUrl` подставляется вручную — обновить под новый контракт.

---

## 4. Раздел "Очки": блок "Мои достижения"

### 4.1 Размещение

В существующем экране "Очки" / "Лидерборд" добавить секцию **"Мои достижения"** ниже баланса / истории очков (точное место — по дизайну).

### 4.2 Состояния

- **Пусто** — пользователь ещё не получил ачивок: показать заглушку ("Получай достижения, создавая события и участвуя в жизни клубов").
- **С ачивками** — сетка карточек ачивок.

### 4.3 Компонент `AchievementCard`

```
┌─────────────────────────────┐
│  [Иконка 64×64]             │
│  Название ачивки            │
│  Короткое описание          │
│                             │
│  [Применить]                │  ← если не активна
│  [Снять]                    │  ← если активна (заменяет кнопку)
└─────────────────────────────┘
```

**Props:**
```typescript
interface AchievementCardProps {
  achievement: AchievementDto;
  onApply: (id: string) => void;
  onRemove: () => void;
  isPending: boolean;   // блокировать кнопки во время запроса
}
```

**Логика кнопок:**
- `isActive === false` → кнопка **"Применить"**, `onClick` → `setActiveAchievement({ achievementId: achievement.id })`
- `isActive === true` → кнопка **"Снять"**, `onClick` → `setActiveAchievement({ achievementId: null })`
- Одновременно активной может быть только одна ачивка (контролируется полем `isActive` с бэка; при применении новой — предыдущая становится `isActive: false`).

---

## 5. Получение ачивки: UX-флоу

### 5.1 Триггер

После успешного `createEvent`, `joinEvent`, `confirmAttendance`:

```typescript
const result = await createEvent(dto).unwrap();
// аналогично для joinEvent и confirmAttendance

if (result.unlockedAchievements.length > 0) {
  triggerAchievementConfetti();
  openAchievementModal(result.unlockedAchievements[0]); // если ачивок несколько — показывать по очереди
}
```

**Какой эндпоинт возвращает `unlockedAchievements`:**

| Действие | Мутация | Ачивка |
|---|---|---|
| Создать событие | `POST /events` | Один дома |
| Вступить в событие | `POST /events/:id/join` | Первый мститель |
| Подтвердить посещение | `POST /events/:id/attendance` | Уилсон |

### 5.2 Конфетти

Использовать библиотеку `canvas-confetti` (согласовать добавление зависимости с командой):

```typescript
import confetti from 'canvas-confetti';

function triggerAchievementConfetti(): void {
  confetti({
    particleCount: 120,
    spread: 70,
    origin: { y: 0.6 },
  });
}
```

> Альтернатива без новой зависимости: CSS-анимация через keyframes. Уточнить предпочтение.

### 5.3 Модалка `AchievementUnlockedModal`

```
┌───────────────────────────────┐
│   🎉  Новое достижение!       │
│                               │
│   [Иконка 96×96]              │
│   Название ачивки             │
│   Описание                    │
│                               │
│   [Применить аватар]          │
│   [Закрыть]                   │
└───────────────────────────────┘
```

**Поведение:**
- "Применить аватар" → вызывает `setActiveAchievement`, закрывает модалку, инвалидирует кеш.
- "Закрыть" → просто закрывает.
- Если `unlockedAchievements.length > 1` — показывать модалки последовательно (после закрытия первой — следующая) или все ачивки в одной модалке (уточнить по дизайну).

---

## 6. Лидерборд: обновление аватара

Компонент строки лидерборда уже использует `avatarUrl` пользователя. После бэкенд-изменений (п. 6 спеки бэка) поле `avatarUrl` в ответе `/leaderboard` будет автоматически содержать иконку ачивки, если она активна.

**Проверить:** что поле `avatarUrl` присутствует в `LeaderboardItemDto` и передаётся в компонент аватара.

---

## 7. Уведомления

Бэкенд создаёт in-app уведомление типа `achievement_unlocked` при получении ачивки. На фронте:

- Добавить обработку типа `achievement_unlocked` в компонент/список уведомлений.
- Отображение: иконка ачивки (если доступна `targetId`), текст "Новое достижение: {name}".
- `targetId` — UUID ачивки (для перехода в раздел "Мои достижения" по тапу).

---

## 8. Что будет дополнено

- [ ] Точное размещение блока ачивок в экране "Очки" (после получения дизайна)
- [ ] Решение по конфетти (canvas-confetti vs CSS)
- [ ] Тип уведомления `achievement_unlocked` в маппинге уведомлений
- [ ] Новые ачивки и соответствующие мутации (по мере согласования)
