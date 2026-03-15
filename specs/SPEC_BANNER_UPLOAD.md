# Спека: Загрузка баннеров для ивентов и клубов

> Статус: актуальная.

---

## 1. Общая концепция

- Пользователь загружает изображение через отдельный эндпоинт `POST /upload/banner`.
- В ответ получает абсолютный URL (`{ url }`) и передаёт его как `coverUrl` при создании или редактировании клуба / ивента.
- Файлы хранятся на диске в `static/banners/`, отдаются как статика через `/static/banners/<filename>`.
- `coverUrl` имеет приоритет над `coverSeed`: если задан — показывается изображение, иначе — градиент.
- При смене баннера старый файл удаляется с диска.

---

## 2. Бэкенд

### 2.1 Новый модуль `UploadModule`

```
src/modules/upload/
├── upload.controller.ts
├── upload.module.ts
└── dto/
    └── response/
        └── upload-banner.res.dto.ts
```

**`upload.controller.ts`**

```typescript
@Controller('upload')
@Roles('Member')
export class UploadController {
  constructor(private readonly config: ConfigService) {}

  @Post('banner')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiResponse({ status: HttpStatus.CREATED, type: UploadBannerResDto })
  uploadBanner(
    @UploadedFile() file: Express.Multer.File,
  ): UploadBannerResDto {
    const baseUrl = this.config.get<string>(EnvVariableName.APP_BASE_URL) ?? 'http://localhost:4000';
    return { url: `${baseUrl}/static/banners/${file.filename}` };
  }
}
```

**`upload.module.ts`**

```typescript
@Module({
  imports: [
    MulterModule.register({
      storage: diskStorage({
        destination: join(process.cwd(), 'static', 'banners'),
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname);
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
    }),
  ],
  controllers: [UploadController],
})
export class UploadModule {}
```

**`upload-banner.res.dto.ts`**

```typescript
export class UploadBannerResDto {
  @ApiProperty({ description: 'Абсолютный URL загруженного баннера' })
  declare url: string;
}
```

**`app.module.ts`** — добавить `UploadModule` в импорты.

**`static/banners/`** — создать директорию (добавить `.gitkeep`).

**`Dockerfile`** — в runtime-стадии уже есть `COPY static/ static/`, поэтому `static/banners/` появится автоматически. Убедиться, что директория не gitignored.

---

### 2.2 Миграция: добавить `coverUrl` к `Event`

В `schema.prisma` у `Club` поле уже есть. Для `Event` добавить:

```prisma
model Event {
  // ...
  coverUrl  String?   // добавить
  coverSeed String?
}
```

После изменения схемы:

```bash
npm run prisma:migrate   # dev
```

Имя миграции: `add_event_cover_url`.

---

### 2.3 Удаление старого файла при смене баннера

Вспомогательная функция — `src/shared/helpers/delete-banner.helper.ts`:

```typescript
import { unlink } from 'fs/promises';
import { join } from 'path';

/**
 * Удаляет локальный файл баннера, если URL указывает на /static/banners/.
 * Игнорирует ошибку, если файл уже не существует.
 */
export async function deleteBannerIfLocal(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const marker = '/static/banners/';
  const idx = url.indexOf(marker);
  if (idx === -1) return; // внешний URL — не трогаем
  const filename = url.slice(idx + marker.length);
  if (!filename) return;
  try {
    await unlink(join(process.cwd(), 'static', 'banners', filename));
  } catch {
    // файл уже удалён или не существует — ок
  }
}
```

---

### 2.4 `UpdateClubHandler` — удалять старый баннер

```typescript
// До обновления клуба в БД:
if (dto.coverUrl !== undefined && dto.coverUrl !== club.coverUrl) {
  await deleteBannerIfLocal(club.coverUrl);
}
```

---

### 2.5 `UpdateEventHandler` — удалять старый баннер

```typescript
// До обновления ивента в БД:
if (dto.coverUrl !== undefined && dto.coverUrl !== event.coverUrl) {
  await deleteBannerIfLocal(event.coverUrl);
}
```

---

### 2.6 `CreateEventHandler` / `UpdateEventHandler` — принять `coverUrl`

**`CreateEventReqDto`** — добавить поле:

```typescript
@IsOptional()
@IsUrl()
coverUrl?: string;
```

**`UpdateEventReqDto`** — добавить поле:

```typescript
@IsOptional()
@IsUrl()
coverUrl?: string | null;
```

**`CreateEventHandler`**:

```typescript
await this.prisma.event.create({
  data: {
    // ...
    coverUrl: dto.coverUrl,
    coverSeed: dto.coverSeed,
  },
});
```

**`UpdateEventHandler`**:

```typescript
await this.prisma.event.update({
  data: {
    // ...
    ...(dto.coverUrl !== undefined && { coverUrl: dto.coverUrl }),
    ...(dto.coverSeed !== undefined && { coverSeed: dto.coverSeed }),
  },
});
```

---

### 2.7 Response DTO — включить `coverUrl` в ответы ивентов

Где `coverSeed` уже есть — добавить рядом `coverUrl`:

- `EventDetailResDto`
- `EventListItemResDto`
- Хэндлеры, которые маппят ивент в ответ: добавить `coverUrl: event.coverUrl ?? null`

---

### 2.8 Итоговый контракт `POST /upload/banner`

| Поле | Значение |
|---|---|
| Метод | `POST` |
| URL | `/upload/banner` |
| Auth | `x-telegram-init-data` (любой авторизованный пользователь) |
| Content-Type | `multipart/form-data` |
| Поле файла | `file` |
| Ответ 201 | `{ "url": "https://..." }` |

---

## 3. Фронтенд

### 3.1 RTK Query: новая мутация `uploadBanner`

```typescript
// src/shared/api/upload-api.ts
export const uploadApi = apiBase.injectEndpoints({
  endpoints: (builder) => ({
    uploadBanner: builder.mutation<{ url: string }, File>({
      query: (file) => {
        const body = new FormData();
        body.append('file', file);
        return {
          url: '/upload/banner',
          method: 'POST',
          body,
          formData: true,
        };
      },
    }),
  }),
});

export const { useUploadBannerMutation } = uploadApi;
```

---

### 3.2 Компонент `BannerUpload`

Переиспользуемый компонент — подключается к формам создания/редактирования клубов и ивентов.

```
src/shared/components/banner-upload.tsx
src/shared/components/styles/banner-upload.css
```

**Props:**

```typescript
interface BannerUploadProps {
  currentUrl: string | null | undefined;  // текущий coverUrl (для превью)
  onUpload: (url: string) => void;        // вызывается с URL после успешной загрузки
  onRemove: () => void;                   // сбросить coverUrl (передать null)
  isUploading: boolean;                   // блокировать кнопку во время загрузки
}
```

**UX:**

```
┌────────────────────────────────────────┐
│  [Превью изображения 16:9]             │  ← если coverUrl задан
│     или                                │
│  [Область drag-and-drop / кнопка]      │  ← если не задан
│                                        │
│  [Загрузить фото]   [Удалить]          │
└────────────────────────────────────────┘
```

- Клик на кнопку «Загрузить фото» → открывает `<input type="file" accept="image/*">`.
- После выбора файла → вызов `uploadBanner(file)` → в `onUpload(url)` передаётся полученный URL.
- Кнопка «Удалить» → вызов `onRemove()`, очищает превью.
- Во время загрузки кнопки заблокированы, показывается спиннер.

---

### 3.3 Форма создания ивента (`use-event-form.ts` + UI)

1. В стейт формы добавить `coverUrl: string | null`.
2. Подключить `useUploadBannerMutation`.
3. Вставить `<BannerUpload>` в форму.
4. При сабмите передавать `coverUrl` в мутацию `createEvent`.

---

### 3.4 Форма создания клуба (`use-club-form.ts` + UI)

Аналогично ивенту. `coverUrl: undefined` уже есть в стейте — заменить на `coverUrl: null`, подключить `<BannerUpload>`.

---

### 3.5 Формы редактирования (ивент / клуб)

При открытии формы редактирования передавать текущий `coverUrl` как начальное значение в `<BannerUpload currentUrl={...}>`. При сохранении передавать обновлённый `coverUrl`.

---

### 3.6 Обновление типов сущностей

**`src/entities/event/types.ts`** — добавить:

```typescript
// В EventCard и EventDetails:
coverUrl: string | null;
```

**`src/entities/club/types.ts`** — поле `coverUrl: string | null` уже есть.

---

### 3.7 Отображение баннера

#### Карточки ленты (EventFeedCard, ClubFeedCard)

`coverUrl` имеет приоритет над `coverSeed`:

```typescript
const cardBackgroundStyle = useMemo(() => {
  if (event.coverUrl) {
    return {
      backgroundImage: `url('${event.coverUrl}')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }
  if (event.coverSeed) {
    return { background: buildGradient(event.coverSeed, 'event') };
  }
  return { background: getEventGradient(event.id) };
}, [event.coverUrl, event.coverSeed, event.id]);
```

Аналогично для `ClubFeedCard`.

#### Детальные страницы

`DetailsLayout` уже принимает `coverUrl` и отображает как `background-image`. Достаточно передать `event.coverUrl`:

```tsx
// event-details/index.tsx — добавить coverUrl
<DetailsLayout coverUrl={details.data?.coverUrl ?? null} ... />
```

#### Страница деталей клуба

`club-details/index.tsx` уже использует `coverUrl` — изменений не требует при условии, что API возвращает актуальный `coverUrl`.

---

## 4. Порядок реализации

### Бэкенд
1. Создать `static/banners/.gitkeep`
2. Создать `UploadModule` с `POST /upload/banner`
3. Добавить хелпер `deleteBannerIfLocal`
4. Добавить `coverUrl` в `Event`-схему + миграция
5. Обновить `CreateEventReqDto`, `UpdateEventReqDto`
6. Обновить `CreateEventHandler`, `UpdateEventHandler` (сохранять `coverUrl`, удалять старый файл)
7. Обновить `UpdateClubHandler` (удалять старый файл)
8. Обновить response DTO ивентов (добавить `coverUrl`)
9. Добавить `UploadModule` в `AppModule`

### Фронтенд
1. Создать `upload-api.ts` с мутацией `uploadBanner`
2. Создать компонент `BannerUpload`
3. Добавить `coverUrl` в типы `EventCard`, `EventDetails`
4. Обновить `EventFeedCard`, `ClubFeedCard` — рендер с приоритетом `coverUrl`
5. Обновить `event-details/index.tsx` — передать `coverUrl` в `DetailsLayout`
6. Подключить `BannerUpload` в формы создания/редактирования ивентов и клубов
