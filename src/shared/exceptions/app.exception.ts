import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Deny-list чувствительных полей.
 * Перекрывает snake_case (access_token), camelCase (accessToken), слитное написание (apikey).
 * Разделители между словами необязательны благодаря .?.
 */
const SENSITIVE_FIELDS_RE =
  /password|secret|token|api.?key|access|refresh|auth|credential|private|cvv|pin|jwt|bearer|session|cookie|ssn|card|otp|hash|salt|signature|cert|pem/i;

const MAX_STRING_LENGTH = 200;

export type AppExceptionPayload = {
  isAppException: true;
  statusCode: HttpStatus;
  message: string;
  /** Файл и функция — место броска исключения, захваченное через Error.captureStackTrace */
  module: string;
  /** Санитизированный контекст запроса для логирования */
  input?: Record<string, unknown>;
};

/**
 * Исключение для непредвиденных ситуаций в бизнес-логике.
 *
 * Предназначен для throw в случаях нарушения инварианта или ошибки программиста —
 * не для ожидаемых доменных ответов (они возвращаются напрямую из хэндлера).
 *
 * Автоматически:
 * - фиксирует место броска (файл/функция) через captureStackTrace
 * - удаляет чувствительные поля из `input` перед записью в лог
 * - обрезает длинные строки (> 200 символов)
 *
 * @example
 * // Нарушение инварианта — участник не может быть одновременно организатором
 * if (event.creatorUserId === command.userId) {
 *   throw new AppException({
 *     statusCode: HttpStatus.CONFLICT,
 *     message: 'Организатор не может быть участником собственного события',
 *     input: { eventId: event.id, userId: command.userId },
 *   });
 * }
 */
export class AppException extends HttpException {
  constructor(opts: {
    statusCode: HttpStatus;
    message: string;
    input?: Record<string, unknown>;
  }) {
    const payload: AppExceptionPayload = {
      isAppException: true,
      statusCode: opts.statusCode,
      message: opts.message,
      module: AppException.captureCallerLocation(),
      input: AppException.sanitizeInput(opts.input),
    };
    super(payload, opts.statusCode);
  }

  /**
   * Захватывает фрейм вызова через Error.captureStackTrace, чтобы указывать на реальный источник.
   * С source-map-support пути ведут к исходным .ts-файлам.
   */
  private static captureCallerLocation(): string {
    const target = {} as { stack: string };
    Error.captureStackTrace(target, AppException);
    const callerLine = target.stack.split('\n')[1]?.trim() ?? '';
    const match = callerLine.match(/^at\s+(?:new\s+)?([^\s(]+)\s+\(([^)]+)\)/);
    if (match) {
      const [, funcName, location] = match;
      return `${funcName} (${location})`;
    }
    return callerLine.replace(/^at\s+/, '') || 'unknown';
  }

  /**
   * Рекурсивно удаляет чувствительные поля из входных данных перед записью в лог.
   * Обходит не глубже MAX_SANITIZE_DEPTH — предотвращает stack overflow
   * при намеренно глубоко вложенном payload.
   */
  static sanitizeInput(
    input?: Record<string, unknown>,
    depth = 0,
  ): Record<string, unknown> | undefined {
    if (!input) return undefined;
    return Object.fromEntries(
      Object.entries(input)
        .filter(([key]) => !SENSITIVE_FIELDS_RE.test(key))
        .map(([key, value]) => [key, AppException.sanitizeValue(value, depth)]),
    );
  }

  private static readonly MAX_SANITIZE_DEPTH = 5;

  private static sanitizeValue(value: unknown, depth: number): unknown {
    if (depth >= AppException.MAX_SANITIZE_DEPTH) return '[too deep]';
    if (Array.isArray(value)) {
      return value.map((item) => AppException.sanitizeValue(item, depth + 1));
    }
    if (value !== null && typeof value === 'object') {
      return AppException.sanitizeInput(
        value as Record<string, unknown>,
        depth + 1,
      );
    }
    // Длинные строки обрезаются — исключает случайную утечку секретов
    // переданных как значение поля с безобидным именем (например, Bearer-токен в data)
    if (typeof value === 'string' && value.length > MAX_STRING_LENGTH) {
      return value.slice(0, MAX_STRING_LENGTH) + '[…truncated]';
    }
    return value;
  }
}
