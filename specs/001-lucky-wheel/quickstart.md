# Quickstart: Lucky Wheel for Events

## Preconditions
- Backend and frontend are running locally.
- User is authenticated in Telegram Mini App context.
- Test data contains upcoming and non-upcoming events with mixed capacity/join state.

## Scenario A: Secret reveal by fast scrolling
1. Open `Home -> Events`.
2. Perform fast up/down scrolling so 9 event cards are viewed in under 3 seconds.
3. Verify button `Мне повезет` appears.
4. Repeat slow scrolling: verify button does not appear.

## Scenario B: Wheel spin and event open
1. Tap `Мне повезет`.
2. On wheel screen tap `Запустить` once.
3. Verify single in-flight run (no double spin).
4. Wait until wheel stops.
5. Verify event details screen opens with selected event id.

## Scenario C: Eligibility filters
1. Ensure dataset includes:
   - joined event,
   - full event (`maxParticipants` reached),
   - upcoming with seats,
   - past/ongoing events.
2. Run wheel multiple times.
3. Verify selected events are only upcoming with seats and not joined.

## Scenario D: Daily limit
1. Trigger and complete one lucky run.
2. Try to reveal/launch again in the same UTC calendar day.
3. Verify backend denies with `DAILY_LIMIT_REACHED` and UI shows fallback.
4. Move to next UTC day and verify availability resets.

## Dev checks
- Frontend: `cd /Users/frolov.f/hack2026/events-xakaton-next && npm run lint`
- Backend: `cd /Users/frolov.f/hack2026/events-xakaton-nestjs && npm run lint && npm run typecheck`
