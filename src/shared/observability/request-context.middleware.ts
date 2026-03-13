import { Injectable, NestMiddleware } from '@nestjs/common';
import { trace } from '@opentelemetry/api';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

/**
 * Middleware для добавления correlation ID к каждому запросу.
 *
 * Читает x-request-id из входящего заголовка или генерирует новый UUID.
 * Также извлекает traceId и spanId из активного OpenTelemetry span (если включён).
 *
 * Добавленные поля (requestId, traceId, spanId) используются в HttpExceptionFilter
 * для корреляции логов ошибок с запросами.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const existing = req.header('x-request-id');
    const requestId = existing || randomUUID();
    const spanContext = trace.getActiveSpan()?.spanContext();

    (
      req as Request & { requestId?: string; traceId?: string; spanId?: string }
    ).requestId = requestId;
    (
      req as Request & { requestId?: string; traceId?: string; spanId?: string }
    ).traceId = spanContext?.traceId;
    (
      req as Request & { requestId?: string; traceId?: string; spanId?: string }
    ).spanId = spanContext?.spanId;

    res.setHeader('x-request-id', requestId);
    if (spanContext?.traceId) {
      res.setHeader('x-trace-id', spanContext.traceId);
    }
    next();
  }
}
