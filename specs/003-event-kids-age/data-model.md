# Data Model: Kids Audience Metadata for Events API

## 1) Event (existing, persistent)

- **Purpose**: Содержит основную информацию о событии.
- **Storage**: PostgreSQL table `Event`.
- **New fields**:
  - `isForKids` (Boolean, default `false`)
  - `kidsMinAge` (Int?, nullable)

### Invariants

- `isForKids = false` => `kidsMinAge = null`
- `isForKids = true` => `kidsMinAge` may be `null` or integer in allowed range

## 2) CreateEventReqDto (request)

- `isForKids` (optional boolean, defaults to `false` on backend)
- `kidsMinAge` (optional integer, `0..17`)

## 3) UpdateEventReqDto (request)

- `isForKids` (optional boolean)
- `kidsMinAge` (optional integer/null in patch semantics)

### Update normalization

- Если patch явно устанавливает `isForKids=false`, backend сбрасывает `kidsMinAge` в `null`.

## 4) EventListItemResDto (response)

- Добавить `isForKids: boolean`
- Добавить `kidsMinAge: number | null`

## 5) EventDetailResDto (response)

- Добавить `isForKids: boolean`
- Добавить `kidsMinAge: number | null`

## 6) ClubEventItemResDto (response)

- Добавить `isForKids: boolean`
- Добавить `kidsMinAge: number | null`

## 7) State transitions (audience-related)

- **Adult default**: `(false, null)`
- **Enable kids**: `(false, null) -> (true, null|N)`
- **Set age**: `(true, null) -> (true, N)`
- **Disable kids**: `(true, null|N) -> (false, null)`
