import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as compression from 'compression';
import { Logger } from 'nestjs-pino';
import 'reflect-metadata';

import { EnvVariableName } from '@shared/config';
import { initOtel } from '@shared/observability';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  // Инициализируем OTel первым — до NestFactory.create(), чтобы
  // инструментация перехватила HTTP-клиенты и DB-драйверы с самого старта
  initOtel();

  // bufferLogs: true — буферизует логи NestJS до подключения Pino-логгера,
  // чтобы не потерять сообщения во время инициализации модулей
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Заменяем встроенный NestJS-логгер на Pino (pino-pretty в dev, JSON в prod)
  app.useLogger(app.get(Logger));

  // Добавляет HTTP security headers: X-Content-Type-Options, X-Frame-Options,
  // Strict-Transport-Security, X-XSS-Protection и др.
  // app.use(helmet());

  // Сжатие ответов gzip/deflate — снижает трафик для крупных payload (лидерборд, списки)
  app.use(compression());

  app.enableCors({
    origin: true,
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-telegram-init-data',
      'x-telegram-user-id',
      'x-device-id',
      'x-idempotency-key',
    ],
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Swagger/OpenAPI — доступен по /api/docs в development
  if (process.env[EnvVariableName.NODE_ENV] !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Tribe Events API')
      .setDescription(
        'REST API для Telegram Mini App: события, клубы, геймификация, уведомления.',
      )
      .setVersion('1.0')
      .addApiKey(
        { type: 'apiKey', name: 'x-telegram-init-data', in: 'header' },
        'telegram-init-data',
      )
      .addApiKey(
        { type: 'apiKey', name: 'x-telegram-user-id', in: 'header' },
        'telegram-user-id',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config, {
      // Короткие operationId для генерации TypeScript-клиентов: createEvent вместо EventsController_createEvent
      operationIdFactory: (_controllerKey: string, methodKey: string) =>
        methodKey,
    });
    SwaggerModule.setup('api/docs', app, document);
  }

  // enableShutdownHooks позволяет NestJS перехватывать SIGTERM/SIGINT и корректно
  // вызывать onModuleDestroy у воркеров BullMQ, закрывать Prisma и Redis-соединения
  app.enableShutdownHooks();

  const port = process.env[EnvVariableName.PORT]
    ? Number(process.env[EnvVariableName.PORT])
    : 4000;
  // '0.0.0.0' — слушаем на всех интерфейсах, иначе в Docker сервис недоступен снаружи контейнера
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
