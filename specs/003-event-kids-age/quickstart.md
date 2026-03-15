# Quickstart: Kids Audience Metadata for Events API

## Preconditions

- Backend running locally.
- DB migrated with new `Event` columns.
- Есть права на создание/редактирование события.

## Scenario A: Create adult event (default)

1. Call `POST /events` without `isForKids` and `kidsMinAge`.
2. Expect `201` with event id.
3. Verify in DB/API: `isForKids=false`, `kidsMinAge=null`.

## Scenario B: Create kids event with age

1. Call `POST /events` with:
   ```json
   {
     "title": "Детский мастер-класс",
     "description": "...",
     "locationOrLink": "...",
     "startsAtUtc": "2026-03-20T10:00:00.000Z",
     "endsAtUtc": "2026-03-20T12:00:00.000Z",
     "categoryCode": "general",
     "isForKids": true,
     "kidsMinAge": 6
   }
   ```
2. Expect `201`.
3. Verify `GET /events` and `GET /events/:id` return `isForKids=true`, `kidsMinAge=6`.

## Scenario C: Create kids event without age

1. Call `POST /events` with `isForKids=true` and without `kidsMinAge`.
2. Expect `201` and persisted `(true, null)`.

## Scenario D: Update transitions

1. `PATCH /events/:id` with `isForKids=true`, `kidsMinAge=12`.
2. Verify read endpoints return `(true, 12)`.
3. `PATCH /events/:id` with `isForKids=false`.
4. Verify read endpoints return `(false, null)`.

## Scenario E: Validation

1. Send invalid `kidsMinAge` (e.g. `-1`, `18`, `6.5`).
2. Expect `400 Bad Request`.

## Scenario F: Club events list contract

1. Call `GET /clubs/:clubId/events`.
2. Verify each item includes `isForKids` and `kidsMinAge`.

## Dev checks

```bash
cd /Users/frolov.f/hack2026/events-xakaton-nestjs
npm run typecheck
npm run lint -- --fix
```
