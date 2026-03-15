# Research: Kids Audience Metadata for Events API

## Decision 1: Persist audience metadata in `Event` model directly

- **Decision**: Добавить `isForKids` и `kidsMinAge` как колонки таблицы `Event`.
- **Rationale**: Поля всегда читаются вместе с событием и не требуют отдельной сущности.
- **Alternatives considered**:
  - Вынос в отдельную таблицу `EventAudience`: лишняя сложность без функциональной выгоды.

## Decision 2: Keep `kidsMinAge` optional when `isForKids=true`

- **Decision**: `kidsMinAge` nullable и не обязателен для детского ивента.
- **Rationale**: Поддерживает сценарий "для детей, возраст не уточнен".
- **Alternatives considered**:
  - Делать возраст обязательным: ухудшает UX создания и нарушает продуктовый сценарий.

## Decision 3: Normalize unsafe combinations on write path

- **Decision**: При сохранении `isForKids=false` всегда записывать `kidsMinAge=null`.
- **Rationale**: Гарантирует консистентность хранения независимо от входного payload.
- **Alternatives considered**:
  - Оставлять любое значение в БД: приводит к разночтениям и усложняет UI.

## Decision 4: Expose fields in all event read contracts used by frontend cards/details

- **Decision**: Новые поля возвращаются в `GET /events`, `GET /events/:id`, `GET /clubs/:clubId/events`.
- **Rationale**: Это покрывает все UI-точки (лента, детали, профиль, клубные списки).
- **Alternatives considered**:
  - Добавить только в details: карточки не смогут показать "Для детей".

## Decision 5: Validate `kidsMinAge` as bounded integer

- **Decision**: Валидация как целое число в диапазоне `0..17`.
- **Rationale**: Отсекает некорректные значения и соответствует понятию детской аудитории.
- **Alternatives considered**:
  - Без диапазона: риск мусорных значений.
  - Более узкий диапазон (например, 6..17): не покрывает детские ивенты для младшего возраста.
