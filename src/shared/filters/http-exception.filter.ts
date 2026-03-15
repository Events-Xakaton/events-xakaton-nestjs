import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';

import { HttpStatusDescriptions } from '../constants';
import { AppException, AppExceptionPayload } from '../exceptions';

/**
 * Глобальный фильтр исключений.
 *
 * Три ветки обработки:
 *  1. AppException — ожидаемые исключения с контекстом (module, input).
 *     4xx → warn, 5xx → error со stack trace.
 *  2. HttpException — исключения из ValidationPipe, RbacGuard, VerificationService и т.д.
 *     Логируются без внутренних деталей (4xx → warn, 5xx → error).
 *  3. Error / unknown — непредвиденные ошибки runtime.
 *     Всегда error + stack trace; клиенту возвращается нейтральный 500.
 *
 * Ответ содержит requestId и traceId для корреляции с distributed tracing.
 */
@Catch()
export class GeneralExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    // Фильтр обрабатывает только HTTP-контекст; Telegraf-апдейты — пропускаем
    if (host.getType() !== 'http') {
      this.logger.error(
        { err: exception },
        'Unhandled exception in non-HTTP context',
      );
      return;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<
      Request & { requestId?: string; traceId?: string }
    >();

    const requestId = request.requestId ?? 'unknown';
    const traceId = request.traceId ?? 'unknown';

    const { statusCode, message } = this.resolve(exception, requestId, traceId);

    response.status(statusCode).json({
      statusCode,
      message,
      requestId,
      traceId,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  /**
   * Определяет statusCode и message по типу исключения, логирует с нужным уровнем.
   * Возвращает только те данные, которые безопасно отдать клиенту.
   */
  private resolve(
    exception: unknown,
    requestId: string,
    traceId: string,
  ): { statusCode: HttpStatus; message: string } {
    if (exception instanceof AppException) {
      return this.handleAppException(exception, requestId, traceId);
    }
    if (exception instanceof HttpException) {
      return this.handleHttpException(exception, requestId, traceId);
    }
    if (exception instanceof Error) {
      this.logger.error(
        { requestId, traceId, stack: exception.stack },
        exception.message,
      );
    } else {
      this.logger.error(
        { requestId, traceId, exception },
        'Неизвестная ошибка',
      );
    }
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: HttpStatusDescriptions[HttpStatus.INTERNAL_SERVER_ERROR],
    };
  }

  private handleAppException(
    exception: AppException,
    requestId: string,
    traceId: string,
  ): { statusCode: HttpStatus; message: string } {
    const payload = exception.getResponse() as AppExceptionPayload;
    const { statusCode, message, module: callerModule, input } = payload;

    const logCtx = {
      statusCode,
      module: callerModule,
      input,
      requestId,
      traceId,
    };

    if ((statusCode as number) >= 500) {
      this.logger.error(
        { ...logCtx, stack: exception.stack },
        `[${callerModule}] ${message}`,
      );
    } else {
      this.logger.warn(logCtx, `[${callerModule}] ${message}`);
    }

    return { statusCode, message };
  }

  private handleHttpException(
    exception: HttpException,
    requestId: string,
    traceId: string,
  ): { statusCode: HttpStatus; message: string } {
    const statusCode = exception.getStatus() as HttpStatus;
    // Извлекаем оригинальное сообщение
    const message = this.extractMessage(exception, statusCode);

    const logCtx = { statusCode, requestId, traceId };

    if ((statusCode as number) >= 500) {
      this.logger.error(
        { ...logCtx, stack: exception.stack },
        exception.message,
      );
    } else {
      this.logger.warn(logCtx, exception.message);
    }

    return { statusCode, message };
  }

  /**
   * Извлекает человекочитаемое сообщение из HttpException.
   * ValidationPipe кладёт в getResponse() объект { message: string[] }.
   * Для неизвестных форм — fallback к описанию статуса.
   */
  private extractMessage(
    exception: HttpException,
    statusCode: HttpStatus,
  ): string {
    const resp = exception.getResponse();
    if (typeof resp === 'string') return resp;
    if (typeof resp === 'object' && resp !== null) {
      const r = resp as Record<string, unknown>;
      const msg = r['message'];
      if (typeof msg === 'string') return msg;
      if (Array.isArray(msg) && msg.length > 0)
        return (msg as string[]).join(', ');
    }
    return HttpStatusDescriptions[statusCode] ?? 'Internal Server Error';
  }
}
