# Style Guide — NestJS Microservices Backend

Это руководство по стилю для команды, разрабатывающей бэкенд на NestJS в архитектуре микросервисов. Основано на паттернах, применяемых в проекте.

---

## Содержание

1. [Язык и коммуникация](#1-язык-и-коммуникация)
2. [TypeScript](#2-typescript)
3. [Именование](#3-именование)
4. [Структура проекта](#4-структура-проекта)
5. [NestJS: архитектура и CQRS](#5-nestjs-архитектура-и-cqrs)
6. [Контроллеры](#6-контроллеры)
7. [DTO и валидация](#7-dto-и-валидация)
8. [Схемы и базы данных (Mongoose)](#8-схемы-и-базы-данных-mongoose)
9. [Обработка ошибок и ответы API](#9-обработка-ошибок-и-ответы-api)
10. [Конфигурация и окружение](#10-конфигурация-и-окружение)
11. [Межсервисное взаимодействие](#11-межсервисное-взаимодействие)
12. [Barrel-файлы и импорты](#12-barrel-файлы-и-импорты)
13. [Комментарии и документация](#13-комментарии-и-документация)
14. [Git и коммиты](#14-git-и-коммиты)

---

## 1. Язык и коммуникация

- **Ответы в PR, issues, комментарии к коду** — на русском.
- **Имена переменных, функций, классов, файлов, веток** — только на английском.
- Не смешивай языки в именах: `getUserData`, а не `getПользователь`.

---

## 2. TypeScript

### Строгость

- Включены `strictNullChecks`. Не отключать, не обходить.
- Не использовать `any`. Заменяй на `unknown` с type guard или конкретный тип.
- Не использовать `@ts-ignore` / `@ts-nocheck`. Исправляй причину ошибки.
- Не использовать non-null assertion (`!`). Проверяй явно.
- Не использовать `var`. Используй `const`, при необходимости мутации — `let`.
- Всегда явно типизируй возвращаемые значения функций.

```typescript
// Плохо
const getUser = async (id) => {
  return userModel.findById(id)!;
};

// Хорошо
const getUser = async (id: string): Promise<UserDocument | null> => {
  return userModel.findById(id);
};
```

### `interface` vs `type`

- `interface` — для описания формы объекта (сущности, схемы данных).
- `type` — для union, intersection, utility types, псевдонимов.

```typescript
// interface — форма объекта
export interface IUser {
  telegramId: number;
  username: string;
  moneyBalance: MoneyBalance;
}

// type — производные типы
export type UserDocument = HydratedDocument<User>;
export type RawUserDocument<IdType = Types.ObjectId> = IUser & { _id: IdType };
```

### Enum

Используй `enum` для любой группы связанных именованных констант. Не используй объекты-константы или литеральные union-типы там, где подходит enum.

```typescript
export enum Level {
  ONE = '1',
  TWO = '2',
  THREE = '3',
}

export enum ApiEndpointType {
  USERS = 'users',
  SPINS = 'spins',
  PAYMENTS = 'payments',
}
```

### Zod для runtime-валидации

Используй Zod для схем, которые валидируются в runtime (не в DTO). Тип выводи через `z.infer<>`.

```typescript
export const jwtDataSchema = z.object({
  userId: z.custom(isValidObjectId),
  secretId: z.uuidv4(),
  role: z.enum(UserRole).optional(),
});

export type JwtData = z.infer<typeof jwtDataSchema>;
```

---

## 3. Именование

| Сущность | Конвенция | Пример |
|---|---|---|
| Файлы | `kebab-case` | `user-profile.handler.ts` |
| Переменные, функции | `camelCase` | `getUserById`, `jwtData` |
| Классы | `PascalCase` | `UserModule`, `AuthHandler` |
| Интерфейсы | `I` + `PascalCase` | `IUser`, `IMoneyBalance` |
| Enum | `PascalCase` | `Level`, `ApiCommandType` |
| DTO (запрос) | `PascalCase` + `ReqDto` | `CreatePrizeCategoryReqDto` |
| DTO (ответ) | `PascalCase` + `ResDto` | `ProfileResDto`, `AuthResDto` |
| DTO (межсервисный) | `PascalCase` + `FromGatewayDto` | `ChangeBorderColorFromGatewayDto` |
| Command | `PascalCase` + `Command` | `AuthCommand`, `MakeOneSpinCommand` |
| Query | `PascalCase` + `Query` | `ProfileQuery`, `GetMySpinsQuery` |
| Handler | `PascalCase` + `Handler` | `AuthHandler`, `ProfileHandler` |
| Schema | `PascalCase` + `Schema` | `UserSchema` |
| Entity-класс (Mongoose) | `PascalCase` (без суффикса) | `User`, `Spin` |

---

## 4. Структура проекта

### Монорепо: приложения и библиотеки

```
/
├── apps/                   # Микросервисы
│   └── <service>/
│       └── src/
│           ├── commands/       # CQRS-команды
│           │   ├── index.ts
│           │   └── *.command.ts
│           ├── queries/        # CQRS-запросы
│           │   ├── index.ts
│           │   └── *.query.ts
│           ├── handlers/       # Обработчики команд и запросов
│           │   ├── index.ts
│           │   └── *.handler.ts
│           ├── <service>.controller.ts
│           ├── <service>.module.ts
│           └── main.ts
└── libs/                   # Общие библиотеки
    └── <lib>/
        └── src/
            └── index.ts    # Публичный API библиотеки
```

### Структура shared-библиотеки

```
libs/shared/src/
├── constants/
├── decorators/
├── dto/
│   └── <entity>/
│       ├── request/
│       ├── response/
│       ├── from-gateway/
│       └── index.ts
├── enums/
├── functions/
├── guards/
├── interceptors/
├── schemas/
├── validation/
└── index.ts
```

Каждая директория с экспортами содержит `index.ts`.

---

## 5. NestJS: архитектура и CQRS

### Принципы

- **Бизнес-логика — только в CommandHandler / QueryHandler.** Не создавай `@Injectable()`-сервисы для бизнес-логики.
- **Мутации — через Command, чтения — через Query.** Это не просто организация файлов, а архитектурное разделение ответственности.
- Модуль регистрирует все handlers в `providers`, импортирует `CqrsModule`.

### Command

```typescript
// commands/auth.command.ts
export class AuthCommand {
  constructor(public readonly data: RawUserDocument<string>) {}
}

// commands/index.ts
export { AuthCommand } from './auth.command';
```

### Query

```typescript
// queries/profile.query.ts
export class ProfileQuery {
  constructor(public readonly userId: string) {}
}

// queries/index.ts
export { ProfileQuery } from './profile.query';
```

### CommandHandler

```typescript
@CommandHandler(AuthCommand)
export class AuthHandler implements ICommandHandler<AuthCommand> {
  constructor(
    private readonly redisClientService: RedisClientService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  // Метод execute — через присвоение свойства, а не через объявление метода
  execute: ICommandHandler<AuthCommand>['execute'] = async ({
    data: { _id },
  }) => {
    const currSecret = await this.redisClientService.secretRepository
      .search()
      .where('state')
      .eq(KeyState.CURRENT)
      .returnFirst();

    if (!currSecret || !currSecret[EntityId]) {
      return new GeneralApiResponseDto(
        HttpStatus.BAD_REQUEST,
        HttpStatusDescriptions[HttpStatus.BAD_REQUEST],
      );
    }

    const token = jwt.sign({ userId: _id, secretId: currSecret[EntityId] }, currSecret.pkey);

    return new GeneralApiResponseDto(
      HttpStatus.CREATED,
      HttpStatusDescriptions[HttpStatus.CREATED],
      new AuthResDto(token),
    );
  };
}
```

### QueryHandler

```typescript
@QueryHandler(ProfileQuery)
export class ProfileHandler implements IQueryHandler<ProfileQuery> {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  execute: IQueryHandler<ProfileQuery>['execute'] = async ({ userId }) => {
    const userDoc = await this.userModel.findById(userId).lean({ getters: true });

    const status = userDoc ? HttpStatus.OK : HttpStatus.NOT_FOUND;

    return new GeneralApiResponseDto(
      status,
      HttpStatusDescriptions[status],
      userDoc && new ProfileResDto(userDoc),
    );
  };
}
```

### Регистрация в модуле

```typescript
@Module({
  imports: [CqrsModule, MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])],
  controllers: [UserController],
  providers: [AuthHandler, ProfileHandler, AcceptRulesHandler],
})
export class UserModule {}
```

---

## 6. Контроллеры

### Микросервисный контроллер (TCP)

- Использует `@MessagePattern` для приёма сообщений.
- Только диспетчеризация в CQRS-шину — никакой бизнес-логики.
- Паттерн сообщений: `` `${ApiEndpointType}:${ApiCommandType | ApiQueryType}` ``

```typescript
@Controller()
export class UserController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @MessagePattern(`${ApiEndpointType.USERS}:${ApiCommandType.AUTH}`)
  auth(@Payload() userDoc: RawUserDocument<string>) {
    return this.commandBus.execute(new AuthCommand(userDoc));
  }

  @MessagePattern(`${ApiEndpointType.USERS}:${ApiQueryType.PROFILE}`)
  getProfile(@Payload() userId: string) {
    return this.queryBus.execute(new ProfileQuery(userId));
  }
}
```

### Gateway-контроллер (REST)

- Использует `@UseGuards`, `@ApiOperation`, `@ApiCustomResponse`.
- Принимает запрос, оборачивает данные в FromGatewayDto (если нужно), отправляет в микросервис.
- Возвращает `firstValueFrom(clientProxy.send(...))`.

```typescript
@Controller(ApiEndpointType.USERS)
export class UsersController {
  constructor(
    @Inject(MicroserviceName.USERS)
    private readonly usersServiceClient: ClientProxy,
  ) {}

  @ApiOperation({ summary: 'Creates new JWT token for user' })
  @ApiCustomResponse({ status: HttpStatus.CREATED, message: '...' })
  @UseGuards(InitDataGuard)
  @Post(ApiCommandType.AUTH)
  auth(@UserDoc() user: RawUserDocument): Promise<GeneralApiResponseDto<AuthResDto>> {
    return firstValueFrom(
      this.usersServiceClient.send(
        `${ApiEndpointType.USERS}:${ApiCommandType.AUTH}`,
        user,
      ),
    );
  }
}
```

### Guards

Применяй через `@UseGuards()` на уровне метода или контроллера:

- `InitDataGuard` — валидация Telegram InitData + загрузка пользователя.
- `JwtGuard` — валидация Bearer JWT-токена.
- `RoleGuard` — проверка роли.

---

## 7. DTO и валидация

### Структура файлов

```
dto/<entity>/
├── request/
│   ├── create-<entity>-req.dto.ts
│   └── index.ts
├── response/
│   ├── <entity>-res.dto.ts
│   └── index.ts
├── from-gateway/               # Для передачи данных между gateway и сервисом
│   ├── <action>-from-gateway.dto.ts
│   └── index.ts
└── index.ts
```

### Request DTO

```typescript
export class CreatePrizeCategoryReqDto {
  @ApiProperty({ type: String, example: 'Big money', required: true })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ type: Number, example: 0.5, required: true })
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  @Max(1)
  @IsNotEmpty()
  probability: number;

  @ApiProperty({ type: String, enum: PrizeType, required: true })
  @IsEnum(PrizeType)
  @IsNotEmpty()
  type: PrizeType;
}
```

### Response DTO

Response DTO принимает данные из базы в конструкторе и маппит в нужный формат.

```typescript
export class ProfileResDto {
  readonly _id: string;
  readonly username: string;
  readonly moneyBalance: IMoneyBalance;

  constructor(doc: RawUserDocument) {
    this._id = doc._id.toString();
    this.username = doc.username;
    this.moneyBalance = doc.moneyBalance;
  }
}
```

### FromGateway DTO

Используй для упаковки данных перед отправкой в микросервис, когда нужно передать и данные из JWT/Guard, и данные из тела запроса.

```typescript
export class ChangeBorderColorFromGatewayDto {
  constructor(
    public readonly userId: string,
    public readonly dto: ChangeBorderColorReqDto,
  ) {}
}
```

---

## 8. Схемы и базы данных (Mongoose)

### Schema-класс

- Определи `interface I<Name>` — плоская форма данных.
- Определи `type <Name>Document = HydratedDocument<Name>` — Mongoose-документ.
- Определи `type Raw<Name>Document` — plain-объект для передачи между сервисами.
- Класс реализует интерфейс через `implements I<Name>`.

```typescript
export interface IUser {
  telegramId: number;
  username: string;
}

export type UserDocument = HydratedDocument<User>;
export type RawUserDocument<IdType = Types.ObjectId> = IUser & { _id: IdType };

@Schema({ toJSON: { getters: true }, toObject: { getters: true } })
export class User implements IUser {
  @Prop({ type: Number, required: true, unique: true })
  telegramId: number;

  @Prop({ type: String, required: true })
  username: string;
}

const UserSchema = SchemaFactory.createForClass(User);

// Индексы — отдельно, после создания схемы
UserSchema.index({ telegramId: 1 }, { unique: true });

// Плагины — в конце
UserSchema.plugin(mongooseLeanGetters);

export { UserSchema };
```

### Значения по умолчанию

Используй `satisfies` для типизации default-значений вложенных схем:

```typescript
@Prop({
  type: MoneyBalance,
  default: {
    balance: 0,
    frozenAmount: 0,
  } satisfies IMoneyBalance,
})
moneyBalance: MoneyBalance;
```

### Запросы

- Всегда используй `.lean({ getters: true })` для read-запросов, где не нужны Mongoose-методы.
- Не используй голый `.lean()` при наличии геттеров — они не применятся без плагина.

```typescript
const user = await this.userModel.findById(userId).lean({ getters: true });
```

### Транзакции

Используй обёртку `withTransaction` для всех операций, требующих атомарности:

```typescript
const result = await withTransaction(this.mongodbConnection, async (session) => {
  const user = await this.userModel.findById(userId).session(session);

  if (!user) {
    return new GeneralApiResponseDto(HttpStatus.NOT_FOUND, HttpStatusDescriptions[HttpStatus.NOT_FOUND]);
  }

  user.moneyBalance.balance += amount;
  await user.save({ session });

  return new GeneralApiResponseDto(
    HttpStatus.OK,
    HttpStatusDescriptions[HttpStatus.OK],
  );
});
```

---

## 9. Обработка ошибок и ответы API

### Главное правило

**Никогда не бросай исключения из handlers.** Все результаты — успешные и ошибочные — возвращаются через `GeneralApiResponseDto`.

```typescript
// Плохо
throw new BadRequestException('User not found');

// Хорошо
return new GeneralApiResponseDto(
  HttpStatus.NOT_FOUND,
  HttpStatusDescriptions[HttpStatus.NOT_FOUND],
);
```

### Структура ответа

```typescript
export class GeneralApiResponseDto<T = any> {
  constructor(
    public readonly statusCode: HttpStatus,
    public readonly message: HttpStatusMessage,
    public readonly data?: T,
    public readonly error?: any,
  ) {}
}
```

### Примеры

```typescript
// Успех без данных
return new GeneralApiResponseDto(HttpStatus.OK, HttpStatusDescriptions[HttpStatus.OK]);

// Успех с данными
return new GeneralApiResponseDto(
  HttpStatus.CREATED,
  HttpStatusDescriptions[HttpStatus.CREATED],
  new AuthResDto(token),
);

// Ошибка
return new GeneralApiResponseDto(
  HttpStatus.BAD_REQUEST,
  HttpStatusDescriptions[HttpStatus.BAD_REQUEST],
);

// Ошибка с деталями
return new GeneralApiResponseDto(
  HttpStatus.UNPROCESSABLE_ENTITY,
  HttpStatusDescriptions[HttpStatus.UNPROCESSABLE_ENTITY],
  undefined,
  { field: 'probability', message: 'Sum exceeds 1' },
);
```

### TransformResponseInterceptor

Глобальный интерцептор преобразует ответы с кодами, отличными от 200/201, в HTTP-исключения. Его не нужно добавлять вручную в каждый контроллер.

---

## 10. Конфигурация и окружение

### Правила

- Все переменные окружения — через `ConfigService`, не через `process.env` напрямую (исключение — схемы Mongoose, где нет DI).
- Имена переменных — в enum `EnvVariableName`.
- Секреты — только через переменные окружения, никогда в коде.
- Всегда обновляй `.env.example` при добавлении новой переменной.

```typescript
// Плохо
const host = process.env.USERS_SERVICE_HOST;

// Хорошо
const host = this.configService.getEnvVariable<string>(EnvVariableName.USERS_SERVICE_HOST);
```

### Структура ConfigService

```typescript
@Injectable()
export class ConfigService {
  private readonly envData: EnvData = {
    ...getApiConfig(),
    ...getDbConfig(),
    ...getMicroservicesConfig(),
  };

  getEnvVariable = <T>(key: keyof EnvData): T => this.envData[key] as T;

  getMicroserviceConfig = (key: MicroserviceName) => ({
    options: this.microserviceData[key].options,
    transport: Transport.TCP,
  });
}
```

---

## 11. Межсервисное взаимодействие

### Паттерн сообщений

Паттерн сообщений строится из enum-констант:

```typescript
// Формат: `${ApiEndpointType}:${ApiCommandType | ApiQueryType}`
`${ApiEndpointType.USERS}:${ApiCommandType.AUTH}`   // → "users:auth"
`${ApiEndpointType.SPINS}:${ApiQueryType.MY_SPINS}` // → "spins:my-spins"
```

Не хардкодь строки сообщений — только через enum.

### Отправка из Gateway

```typescript
// Команда (изменение состояния)
return firstValueFrom(
  this.usersServiceClient.send(
    `${ApiEndpointType.USERS}:${ApiCommandType.AUTH}`,
    user,
  ),
);

// Событие (fire-and-forget)
this.spinsServiceClient.emit(
  `${ApiEndpointType.SPINS}:${ApiEventType.SPIN_COMPLETED}`,
  spinData,
);
```

### Добавление нового микросервиса

1. Добавь имя в `MicroserviceName` enum.
2. Добавь переменные хоста/порта в `.env.example` и `EnvVariableName`.
3. Добавь конфигурацию в `ConfigService.microserviceData`.
4. Зарегистрируй провайдер в `GatewayModule`.

---

## 12. Barrel-файлы и импорты

### Правило

Каждая директория с экспортируемыми модулями должна содержать `index.ts`.

```typescript
// dto/users/index.ts
export * from './request';
export * from './response';
export * from './from-gateway';

// dto/index.ts
export { GeneralApiResponseDto } from './general-api-response.dto';
export * from './users';
export * from './spins';
export * from './payments';
```

### Порядок импортов

1. Node.js стандартные модули
2. Сторонние пакеты (сгруппированы по источнику)
3. Внутренние алиасы (`@app/...`)
4. Относительные импорты (`./`, `../`)

```typescript
import * as jwt from 'jsonwebtoken';
import { EntityId } from 'redis-om';

import { AnalyticsService } from '@app/posthog/services';
import { RedisClientService } from '@app/redis-db';
import { HttpStatusDescriptions } from '@app/shared/constants';
import { AuthResDto, GeneralApiResponseDto } from '@app/shared/dto';

import { AuthCommand } from '../commands';
```

### Алиасы путей

Используй алиасы вместо относительных путей при импорте из `libs`:

```typescript
// Плохо
import { ConfigService } from '../../../libs/config/src/config.service';

// Хорошо
import { ConfigService } from '@app/config';
```

---

## 13. Комментарии и документация

### Когда комментировать

Комментируй **зачем**, а не **что**. Очевидные операции не комментируй.

```typescript
// Плохо — очевидно из кода
// Ищем пользователя по ID
const user = await this.userModel.findById(userId);

// Хорошо — объясняет причину
// Redis хранит только текущий секрет, поэтому при его отсутствии выдача токена невозможна
if (!currSecret) {
  return new GeneralApiResponseDto(HttpStatus.BAD_REQUEST, ...);
}
```

Документируй:
- Нетривиальные алгоритмы (вероятностные расчёты, финансовые формулы).
- Неочевидные зависимости между сервисами.
- Магические числа и константы.
- Причины отступления от общего паттерна.

### JSDoc для публичных методов Gateway

```typescript
/**
 * Создаёт новый JWT-токен для пользователя.
 * Требует валидного Telegram InitData в заголовке.
 */
@Post(ApiCommandType.AUTH)
auth(@UserDoc() user: RawUserDocument): Promise<GeneralApiResponseDto<AuthResDto>> { ... }
```

### Swagger

Каждый endpoint в gateway-контроллере должен иметь `@ApiOperation` и `@ApiCustomResponse` для всех возможных статусов ответа, включая ошибочные.

```typescript
@ApiOperation({ summary: 'Creates new JWT token for user' })
@ApiCustomResponse({
  status: HttpStatus.CREATED,
  message: HttpStatusDescriptions[HttpStatus.CREATED],
  dataExample: new AuthResDto('...'),
})
@ApiCustomResponse({
  status: HttpStatus.BAD_REQUEST,
  message: HttpStatusDescriptions[HttpStatus.BAD_REQUEST],
})
@Post(ApiCommandType.AUTH)
auth(...) { ... }
```

---

## 14. Git и коммиты

### Ветвление

```
feature/* → develop → main (релиз)
hotfix/*  → main + develop
```

### Формат коммитов — Conventional Commits на русском

```
<тип>(<область>): <описание>
```

**Типы:** `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`, `perf`

**Правила:**
- Описание — в повелительном наклонении, до 72 символов.
- Один коммит — одно логическое изменение.
- Область — имя микросервиса или библиотеки.

```
feat(users): добавлена смена цвета рамки профиля
fix(spin): исправлен расчёт вероятности при нулевых категориях
refactor(shared): вынесен withTransaction в общую библиотеку
chore(gateway): обновлена зависимость @nestjs/microservices
```

### Перед коммитом

```bash
npm run lint    # должен пройти без ошибок
npm run format  # должен пройти без ошибок
```
