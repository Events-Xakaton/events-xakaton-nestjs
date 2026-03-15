# Feature Specification: Kids Audience Metadata for Events API

**Feature Branch**: `003-event-kids-age`  
**Created**: 2026-03-15  
**Status**: Draft  
**Input**: User description: "Добавить в ивенты инфу о том, что там можно с детьми и от какого возраста; поле должно работать при создании, редактировании и просмотре. На карточках показывать, что это ивент для детей."

## Clarifications

### Session 2026-03-15

- Q: Что фиксируем в доменной модели: только флаг или возраст тоже? → A: Добавляем оба поля: `isForKids` + `kidsMinAge`.
- Q: Какой дефолт для текущего и нового массива ивентов? → A: Дефолт `isForKids=false`, `kidsMinAge=null`.
- Q: Обязателен ли возраст при `isForKids=true`? → A: Нет, возраст опционален; если задан, возвращается как `N+` в UI.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Создание ивента с детской аудиторией через API (Priority: P1)

Как клиент API, я могу создать ивент с флагом детской аудитории и возрастом `N+`, чтобы UI мог корректно маркировать ивенты.

**Why this priority**: без контракта create-flow невозможно получить данные в интерфейсе.

**Independent Test**: отправить `POST /events` в трех вариантах: взрослый, детский без возраста, детский с `kidsMinAge=6`; затем проверить `GET /events` и `GET /events/:id`.

**Acceptance Scenarios**:

1. **Given** `POST /events` без детских полей, **When** ивент создается, **Then** в хранилище устанавливаются `isForKids=false`, `kidsMinAge=null`.
2. **Given** `POST /events` с `isForKids=true` и `kidsMinAge=6`, **When** ивент создается, **Then** значения сохраняются и возвращаются в read-эндпоинтах.
3. **Given** `POST /events` с `isForKids=true` и без `kidsMinAge`, **When** ивент создается, **Then** сохраняется `kidsMinAge=null`.

---

### User Story 2 - Обновление детских полей в API (Priority: P1)

Как клиент API, я могу редактировать детские поля у существующего ивента, чтобы данные оставались актуальными.

**Why this priority**: edit-flow — обязательная часть пользовательского запроса.

**Independent Test**: вызвать `PATCH /events/:id` для переходов `false/null -> true/6 -> true/null -> false/null`.

**Acceptance Scenarios**:

1. **Given** взрослый ивент, **When** `PATCH` получает `isForKids=true` и `kidsMinAge=6`, **Then** ивент обновляется и read-эндпоинты отдают новые значения.
2. **Given** детский ивент с возрастом, **When** `PATCH` получает `kidsMinAge=12`, **Then** возраст обновляется без потери остальных полей.
3. **Given** детский ивент, **When** `PATCH` получает `isForKids=false`, **Then** `kidsMinAge` сбрасывается в `null`.

---

### User Story 3 - Доступность полей в read-контрактах (Priority: P1)

Как клиент API, я получаю детские поля в списках и деталях, чтобы карточки и экран просмотра могли показать "Для детей".

**Why this priority**: фронтенд-карточки строятся из list/detail контрактов.

**Independent Test**: проверить наличие полей в `GET /events`, `GET /events/:id`, `GET /clubs/:clubId/events`.

**Acceptance Scenarios**:

1. **Given** запрос `GET /events`, **When** возвращается список событий, **Then** каждый элемент содержит `isForKids` и `kidsMinAge`.
2. **Given** запрос `GET /events/:id`, **When** возвращаются детали события, **Then** ответ содержит `isForKids` и `kidsMinAge`.
3. **Given** запрос `GET /clubs/:clubId/events`, **When** возвращается список клубных событий, **Then** элементы также содержат `isForKids` и `kidsMinAge`.

---

### Edge Cases

- Legacy-данные без новых колонок после миграции должны корректно читаться как `false/null`.
- Некорректные значения возраста (отрицательное, слишком большое, дробное) должны отклоняться валидацией.
- При `isForKids=false` значение `kidsMinAge` в запросе не должно приводить к неконсистентному состоянию.
- Изменения детских полей не должны ломать текущие сценарии создания/редактирования/списков.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Система MUST добавить в доменную модель `Event` поля `isForKids` (boolean, default `false`) и `kidsMinAge` (nullable integer).
- **FR-002**: `CreateEventReqDto` MUST принимать `isForKids` и `kidsMinAge` (опционально), с дефолтом `false/null` при отсутствии.
- **FR-003**: `UpdateEventReqDto` MUST поддерживать обновление `isForKids` и `kidsMinAge`.
- **FR-004**: При сохранении `isForKids=false` система MUST принудительно устанавливать `kidsMinAge=null`.
- **FR-005**: При сохранении `isForKids=true` система MUST принимать `kidsMinAge` как optional.
- **FR-006**: Система MUST валидировать `kidsMinAge` как целое число в безопасном диапазоне (например `0..17`).
- **FR-007**: `GET /events` MUST возвращать `isForKids` и `kidsMinAge` в каждом элементе списка.
- **FR-008**: `GET /events/:id` MUST возвращать `isForKids` и `kidsMinAge` в деталях ивента.
- **FR-009**: `GET /clubs/:clubId/events` MUST возвращать `isForKids` и `kidsMinAge` в элементах списка.
- **FR-010**: Миграция данных MUST быть backward compatible для уже существующих ивентов.
- **FR-011**: OpenAPI/Swagger контракты MUST документировать новые поля и их семантику.

### Key Entities _(include if feature involves data)_

- **Event**: сущность события с новыми полями `isForKids` и `kidsMinAge`.
- **EventAudienceAttributes**: контракт передачи и валидации признаков детской аудитории в create/update/read потоках.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: В 100% контрактных тестов read-эндпоинты возвращают новые поля для ивентов.
- **SC-002**: В 100% позитивных create/update сценариев сочетания `false/null`, `true/null`, `true/N` обрабатываются корректно.
- **SC-003**: В 100% негативных сценариев невалидный `kidsMinAge` отклоняется с `400`.
- **SC-004**: После миграции 100% legacy ивентов доступны без ошибок и интерпретируются как взрослые по умолчанию.
