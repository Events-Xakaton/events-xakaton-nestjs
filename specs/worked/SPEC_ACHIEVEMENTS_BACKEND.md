# Спека: Ачивки — Backend

> Статус: актуальная. Условия для всех трёх ачивок зафиксированы.

---

## 1. Раздача статических файлов

### 1.1 `src/main.ts`

Добавить перед `app.listen()`:

```typescript
import { join } from 'path';
// ...
app.useStaticAssets(join(__dirname, '..', 'static'), { prefix: '/static' });
```

URL иконок: `GET /static/achievements/<filename>`.

### 1.2 Dockerfile

В runtime-стадию добавить копирование папки `static/`:

```dockerfile
# после COPY --from=build dist/ dist/
COPY ../../static static/
```

### 1.3 Структура папки `static/achievements/`

```
static/
└── achievements/
    ├── at-home-alone.jpg      // "Один дома"
    ├── captain-america.jpg    // "Первый мститель"
    └── willson.jpg            // "Уилсон"
```

> Имена файлов в `iconPath` (Prisma) хранятся как `achievements/<filename>`.

---

## 2. Prisma: изменения схемы

### 2.1 Новые модели

```prisma
model Achievement {
  id          String   @id @default(uuid())
  code        String   @unique   // программный идентификатор
  name        String
  description String
  iconPath    String             // "achievements/captain-america.jpg"

  userAchievements UserAchievement[]
  activeForUsers   User[]           @relation("ActiveAchievement")
}

model UserAchievement {
  id            String      @id @default(uuid())
  userId        String
  achievementId String
  earnedAt      DateTime    @default(now())

  user        User        @relation(fields: [userId], references: [id])
  achievement Achievement @relation(fields: [achievementId], references: [id])

  @@unique([userId, achievementId])  // ачивка выдаётся один раз
}
```

### 2.2 Обновление модели `User`

```prisma
model User {
  // ... существующие поля
  activeAchievementId String?
  activeAchievement   Achievement?      @relation("ActiveAchievement", fields: [activeAchievementId], references: [id])
  achievements        UserAchievement[]
}
```

### 2.3 Обновление типов уведомлений

В схеме добавить `achievement_unlocked` к типам уведомлений:

```prisma
// Если используется enum:
enum NotificationType {
  new_follower
  event_changed
  reminder
  start_reminder
  achievement_unlocked  // добавить
}
```

---

## 3. Ачивки: коды, условия, тригеры

| code | Название | Иконка | Условие | Тригер |
|---|---|---|---|---|
| `home_alone` | Один дома | `at-home-alone.jpg` | Создал событие с `maxParticipants = 1` | `CreateEventHandler` |
| `wilson` | Уилсон | `willson.jpg` | Вызвал `confirmAttendance` и 0 участников подтвердили посещение | `ConfirmAttendanceHandler` |
| `first_avenger` | Первый мститель | `captain-america.jpg` | Первый JOIN на событие **или** JOIN после 30+ дней перерыва | `JoinEventHandler` |

### Описания для пользователя (seed)

- **Один дома** — «Ты создал мероприятие для себя одного. Настоящий интроверт.»
- **Уилсон** — «Ты создал мероприятие, на которое никто не пришёл. Держись, Уилсон!»
- **Первый мститель** — «Ты первым присоединился к новому мероприятию или вернулся после долгого перерыва.»

---

## 4. Модуль `achievements`

### 4.1 Структура файлов

```
src/modules/achievements/
├── commands/
│   ├── AwardAchievement.ts          // AwardAchievementCommand
│   ├── SetActiveAchievement.ts      // SetActiveAchievementCommand
│   └── index.ts
├── queries/
│   ├── GetUserAchievements.ts       // GetUserAchievementsQuery
│   └── index.ts
├── handlers/
│   ├── AwardAchievementHandler.ts
│   ├── SetActiveAchievementHandler.ts
│   ├── GetUserAchievementsHandler.ts
│   └── index.ts
├── dto/
│   ├── request/
│   │   ├── SetActiveAchievementReqDto.ts
│   │   └── index.ts
│   └── response/
│       ├── AchievementResDto.ts
│       └── index.ts
├── achievement-checker.service.ts
├── achievements.controller.ts
└── achievements.module.ts
```

### 4.2 DTO

```typescript
// dto/response/AchievementResDto.ts
export class AchievementResDto {
  @ApiProperty() declare id: string;
  @ApiProperty() declare code: string;
  @ApiProperty() declare name: string;
  @ApiProperty() declare description: string;
  @ApiProperty() declare iconUrl: string;    // абсолютный URL: /static/achievements/...
  @ApiProperty() declare earnedAt: string;   // ISO
  @ApiProperty() declare isActive: boolean;  // применена ли как аватар
}

// dto/request/SetActiveAchievementReqDto.ts
export class SetActiveAchievementReqDto {
  @ApiPropertyOptional({ nullable: true })
  @IsUUID()
  @IsOptional()
  achievementId: string | null;
}
```

### 4.3 Handlers

#### `AwardAchievementHandler`

- Принимает `{ userId, achievementCode }`.
- Находит `Achievement` по `code`. Если не найдена — возвращает `null`.
- Создаёт `UserAchievement` через `upsert` (идемпотентно по `@@unique([userId, achievementId])`).
  - Если запись уже существовала (ачивка была выдана ранее) — возвращает `null`.
- Fire-and-forget: создаёт in-app уведомление через `notificationsService`.
- Возвращает `AchievementResDto` (или `null` если ачивка уже была).

```typescript
void this.notificationsService.createInAppNotification({
  userId,
  type: 'achievement_unlocked',
  title: 'Новое достижение!',
  body: achievement.name,
  targetType: 'achievement',
  targetId: achievement.id,
});
```

#### `SetActiveAchievementHandler`

- Принимает `{ userId, achievementId: string | null }`.
- Если `achievementId` передан — проверяет, что `UserAchievement` с такой парой существует.
- Обновляет `User.activeAchievementId`.
- Возвращает `OkStatusResDto`.

#### `GetUserAchievementsHandler`

- Принимает `{ userId }`.
- Выбирает все `UserAchievement` пользователя с `include: { achievement: true }`.
- Возвращает `AchievementResDto[]` с заполненным полем `isActive`.

### 4.4 Controller

```
GET  /achievements/me          @Roles('Member')  → GetUserAchievementsQuery
POST /achievements/me/active   @Roles('Member')  → SetActiveAchievementCommand
```

`POST /achievements/me/active` принимает `SetActiveAchievementReqDto`:
- `{ achievementId: "uuid" }` — применить ачивку
- `{ achievementId: null }` — снять (вернуть оригинальный аватар)

---

## 5. `AchievementCheckerService`

Инфраструктурный сервис. Экспортируется из `AchievementsModule`. Используется в хэндлерах других модулей.

```typescript
@Injectable()
export class AchievementCheckerService {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly prisma: PrismaService,
  ) {}

  // ─── "Один дома" ────────────────────────────────────────────────────────────
  // Вызывается из CreateEventHandler.
  // Условие: maxParticipants === 1.
  async checkOnEventCreate(
    userId: string,
    eventData: { maxParticipants: number | null },
  ): Promise<AchievementResDto[]> {
    const unlocked: AchievementResDto[] = [];

    if (eventData.maxParticipants === 1) {
      const awarded = await this.award(userId, 'home_alone');
      if (awarded) unlocked.push(awarded);
    }

    return unlocked;
  }

  // ─── "Уилсон" ───────────────────────────────────────────────────────────────
  // Вызывается из ConfirmAttendanceHandler.
  // confirmedCount — количество участников, которых создатель отметил как пришедших.
  // Условие: confirmedCount === 0.
  async checkOnConfirmAttendance(
    creatorUserId: string,
    confirmedCount: number,
  ): Promise<AchievementResDto[]> {
    const unlocked: AchievementResDto[] = [];

    if (confirmedCount === 0) {
      const awarded = await this.award(creatorUserId, 'wilson');
      if (awarded) unlocked.push(awarded);
    }

    return unlocked;
  }

  // ─── "Первый мститель" ───────────────────────────────────────────────────────
  // Вызывается из JoinEventHandler.
  // Условие A: пользователь — первый участник события (EventParticipation.count = 1 после JOIN).
  // Условие B: предыдущий JOIN пользователя был более 30 дней назад (или не было вовсе).
  // Достаточно выполнения любого одного условия.
  async checkOnEventJoin(
    userId: string,
    eventId: string,
  ): Promise<AchievementResDto[]> {
    const unlocked: AchievementResDto[] = [];

    const [participantCount, lastParticipation] = await Promise.all([
      // Считаем после INSERT, поэтому count = 1 означает первый участник
      this.prisma.eventParticipation.count({ where: { eventId } }),
      this.prisma.eventParticipation.findFirst({
        where: { userId, eventId: { not: eventId } },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    const isFirst = participantCount === 1;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const isAfterLongBreak =
      lastParticipation === null ||
      lastParticipation.createdAt < thirtyDaysAgo;

    if (isFirst || isAfterLongBreak) {
      const awarded = await this.award(userId, 'first_avenger');
      if (awarded) unlocked.push(awarded);
    }

    return unlocked;
  }

  // ─── Вспомогательный ────────────────────────────────────────────────────────
  // Диспатчит AwardAchievementCommand. Возвращает DTO только если ачивка новая.
  private async award(userId: string, code: string): Promise<AchievementResDto | null> {
    return this.commandBus.execute(new AwardAchievementCommand(userId, code));
  }
}
```

---

## 6. Интеграция в существующие хэндлеры

### 6.1 `CreateEventHandler`

```typescript
// После создания события и начисления очков:
const unlockedAchievements = await this.achievementCheckerService.checkOnEventCreate(
  user.id,
  { maxParticipants: command.dto.maxParticipants ?? null },
);

return { id: event.id, unlockedAchievements };
```

**Обновление Response DTO:**

```typescript
// src/modules/events/dto/response/CreateEventResDto.ts
export class CreateEventResDto {
  @ApiProperty() declare id: string;
  @ApiProperty({ type: [AchievementResDto] }) declare unlockedAchievements: AchievementResDto[];
}
```

Заменяет `IdResDto` в контроллере и хэндлере.

### 6.2 `JoinEventHandler`

```typescript
// После успешного upsert EventParticipation:
const unlockedAchievements = await this.achievementCheckerService.checkOnEventJoin(
  user.id,
  command.eventId,
);

// unlockedAchievements включить в ответ JoinEventResDto
```

**Обновление Response DTO:**

```typescript
// src/modules/events/dto/response/JoinEventResDto.ts
export class JoinEventResDto {
  @ApiProperty() declare status: 'ok';
  @ApiProperty({ type: [AchievementResDto] }) declare unlockedAchievements: AchievementResDto[];
}
```

> Если текущий хэндлер возвращает `OkStatusResDto` — заменить на `JoinEventResDto`.

### 6.3 `ConfirmAttendanceHandler`

```typescript
// После подтверждения посещений.
// confirmedCount — количество участников, отмеченных как присутствующих.
const unlockedAchievements = await this.achievementCheckerService.checkOnConfirmAttendance(
  user.id,
  confirmedCount,
);

// unlockedAchievements включить в ответ ConfirmAttendanceResDto
```

**Обновление Response DTO:**

```typescript
// src/modules/events/dto/response/ConfirmAttendanceResDto.ts
export class ConfirmAttendanceResDto {
  @ApiProperty() declare status: 'ok';
  @ApiProperty({ type: [AchievementResDto] }) declare unlockedAchievements: AchievementResDto[];
}
```

---

## 7. Аватар: централизованное разрешение

Во всех хэндлерах, возвращающих данные пользователя (лидерборд, участники события, профиль, комментарии), аватар вычисляется через общий хелпер:

```typescript
// src/shared/helpers/resolve-avatar.helper.ts
export function resolveAvatarUrl(
  user: { avatarUrl: string | null; activeAchievement?: { iconPath: string } | null },
  staticBaseUrl: string,
): string | null {
  if (user.activeAchievement) {
    return `${staticBaseUrl}/static/${user.activeAchievement.iconPath}`;
  }
  return user.avatarUrl ?? null;
}
```

`staticBaseUrl` берётся из `ConfigService` (переменная окружения `APP_BASE_URL`).

### Prisma-запросы к обновлению

Во всех запросах, возвращающих данные пользователя, добавить:

```typescript
include: {
  activeAchievement: { select: { iconPath: true } },
}
```

Список хэндлеров к обновлению:
- `GetLeaderboardHandler`
- `ListEventParticipantsHandler`
- `GetEventHandler` (поле `creator`)
- `ListClubMembersHandler` (если есть)
- `GetUserProfileHandler` (если есть)
- Хэндлеры комментариев

---

## 8. Seed

```typescript
const achievements = [
  {
    code: 'home_alone',
    name: 'Один дома',
    description: 'Ты создал мероприятие для себя одного. Настоящий интроверт.',
    iconPath: 'achievements/at-home-alone.jpg',
  },
  {
    code: 'wilson',
    name: 'Уилсон',
    description: 'Ты создал мероприятие, на которое никто не пришёл. Держись, Уилсон!',
    iconPath: 'achievements/willson.jpg',
  },
  {
    code: 'first_avenger',
    name: 'Первый мститель',
    description: 'Ты первым присоединился к новому мероприятию или вернулся после долгого перерыва.',
    iconPath: 'achievements/captain-america.jpg',
  },
];

for (const a of achievements) {
  await prisma.achievement.upsert({
    where: { code: a.code },
    update: { name: a.name, description: a.description },
    create: a,
  });
}
```

---

## 9. `.env.example`

```
APP_BASE_URL=http://localhost:4000
```

Используется для формирования абсолютных URL иконок ачивок в `resolveAvatarUrl`.

---

## 10. Что будет дополнено

- [ ] Новые action-based ачивки (условия и коды будут получены отдельно)
- [ ] Соответствующие методы в `AchievementCheckerService`
