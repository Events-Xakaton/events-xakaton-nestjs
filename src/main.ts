import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import 'reflect-metadata';

import { AppModule } from './app.module';
import { TransformResponseInterceptor } from './shared/interceptors';
import { initOtel } from './shared/observability';

async function bootstrap(): Promise<void> {
  // Инициализируем OTel первым — до NestFactory.create(), чтобы
  // инструментация перехватила HTTP-клиенты и DB-драйверы с самого старта
  initOtel();

  // bufferLogs: true — буферизует логи NestJS до подключения Pino-логгера,
  // чтобы не потерять сообщения во время инициализации модулей
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Заменяем встроенный NestJS-логгер на Pino (pino-pretty в dev, JSON в prod)
  app.useLogger(app.get(Logger));

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // TransformResponseInterceptor не зависит от DI — регистрируем здесь
  app.useGlobalInterceptors(new TransformResponseInterceptor());

  // GeneralExceptionFilter зарегистрирован через APP_FILTER в AppModule —
  // только так PinoLogger может быть инжектирован в него

  // Swagger/OpenAPI — доступен по /api/docs в development
  if (process.env.NODE_ENV !== 'production') {
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

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
}

void bootstrap();
