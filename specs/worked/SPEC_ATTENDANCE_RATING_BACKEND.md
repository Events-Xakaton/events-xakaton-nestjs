# Спека (бэкенд): оценки участников в списке события

**Папка:** `specs/`
**Статус:** Draft
**Зависит от:** `002-attendance-confirmation` (реализован)

---

## Суть задачи

После того как организатор подтвердил присутствие и выставил оценки через
`POST /events/:id/attendance`, эти оценки должны отображаться в ответе
`GET /events/:id/participants`.

Сейчас `EventParticipantResDto` не содержит поля `rating` и `attendanceConfirmed`,
поэтому фронт не может отобразить звёздочки и статус подтверждения.

---

## Изменения

### 1. `EventParticipantResDto`

Добавить два новых поля:

```typescript
// src/modules/events/dto/response/event-participant.res.dto.ts

export class EventParticipantResDto {
  @ApiProperty() readonly telegramUserId: string;
  @ApiProperty() readonly fullName: string;
  @ApiProperty({ nullable: true }) readonly avatarUrl: string | null;
  @ApiProperty() readonly followedByMe: boolean;
  @ApiProperty({ type: RankInfoDto }) readonly rankInfo: RankInfoDto;

  @ApiProperty({
    nullable: true,
    description: 'Оценка от организатора (1–5). null — не выставлена или посещение не подтверждено',
  })
  readonly rating: number | null;                // ← новое

  @ApiProperty({
    description: 'true — организатор подтвердил посещение данного участника',
  })
  readonly attendanceConfirmed: boolean;         // ← новое

  constructor(data: {
    telegramUserId: string;
    fullName: string;
    avatarUrl: string | null;
    followedByMe: boolean;
    rankInfo: RankInfoDto;
    rating: number | null;
    attendanceConfirmed: boolean;
  }) {
    this.telegramUserId = data.telegramUserId;
    this.fullName = data.fullName;
    this.avatarUrl = data.avatarUrl;
    this.followedByMe = data.followedByMe;
    this.rankInfo = data.rankInfo;
    this.rating = data.rating;
    this.attendanceConfirmed = data.attendanceConfirmed;
  }
}
```

---

### 2. `ListEventParticipantsHandler`

Добавить запрос `AttendanceConfirmation` и заполнить новые поля.

```typescript
// src/modules/events/handlers/list-event-participants.handler.ts

// В execute(), в Promise.all добавить третий запрос:
const [followedSet, lifetimeRows, confirmations] = await Promise.all([
  this.userContextService.getFollowedSet(user.id, participantIds),
  this.prisma.pointsLedger.groupBy({
    by: ['userId'],
    _sum: { deltaPoints: true },
    where: { userId: { in: participantIds } },
  }),
  this.prisma.attendanceConfirmation.findMany({    // ← новое
    where: { eventId },
    select: { userId: true, rating: true },
  }),
]);

// Строим Map для O(1) доступа:
const confirmationMap = new Map(
  confirmations.map((c) => [c.userId, c.rating ?? null]),
);

// В маппинге участников:
const items = participants.map(
  (p) =>
    new EventParticipantResDto({
      telegramUserId: p.user.telegramUserId.toString(),
      fullName: p.user.fullName,
      avatarUrl: p.user.avatarUrl ?? null,
      followedByMe: followedSet.has(p.user.id),
      rankInfo: computeRank(lifetimeMap.get(p.user.id) ?? 0),
      rating: confirmationMap.has(p.user.id)        // ← новое
        ? (confirmationMap.get(p.user.id) ?? null)
        : null,
      attendanceConfirmed: confirmationMap.has(p.user.id),  // ← новое
    }),
);
```

---

## Затронутые файлы

| Файл | Изменение |
|---|---|
| `src/modules/events/dto/response/event-participant.res.dto.ts` | Добавить `rating`, `attendanceConfirmed` |
| `src/modules/events/handlers/list-event-participants.handler.ts` | Запрос `AttendanceConfirmation`, заполнение полей |

---

## Граничные случаи

| Ситуация | Поведение |
|---|---|
| Мероприятие ещё не прошло | `AttendanceConfirmation` пустой → все `attendanceConfirmed=false`, `rating=null` |
| Организатор подтвердил без оценки | `attendanceConfirmed=true`, `rating=null` |
| Организатор подтвердил с оценкой | `attendanceConfirmed=true`, `rating=1..5` |
| Участник не в списке подтверждений | `attendanceConfirmed=false`, `rating=null` |

---

## Что НЕ входит в эту задачу

- Изменение `POST /events/:id/attendance` — уже реализован корректно.
- Добавление флага `attendanceSubmitted` в `EventDetailResDto` — отдельная задача.
