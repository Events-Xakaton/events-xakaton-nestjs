import { HttpStatus } from '@nestjs/common';

/**
 * Универсальная обёртка ответа API.
 *
 * Все handlers возвращают этот класс — как успешные, так и ошибочные.
 * TransformResponseInterceptor перехватывает ответы с кодом ≠ 200/201
 * и преобразует их в HttpException, который затем форматирует HttpExceptionFilter.
 *
 * @example
 * // Успех с данными
 * return new GeneralApiResponseDto(HttpStatus.OK, HttpStatusDescriptions[HttpStatus.OK], data);
 *
 * @example
 * // Ошибка без throws
 * return new GeneralApiResponseDto(HttpStatus.NOT_FOUND, HttpStatusDescriptions[HttpStatus.NOT_FOUND]);
 */
export class GeneralApiResponseDto<T = unknown> {
  readonly statusCode: HttpStatus;
  readonly message: string;
  readonly data?: T;
  readonly error?: unknown;

  constructor(
    statusCode: HttpStatus,
    message: string,
    data?: T,
    error?: unknown,
  ) {
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
    this.error = error;
  }
}
