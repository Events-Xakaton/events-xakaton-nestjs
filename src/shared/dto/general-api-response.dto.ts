import { HttpStatus } from '@nestjs/common';

/**
 * Обёртка успешного ответа API.
 *
 * Handlers возвращают этот класс только для успешных результатов (2xx).
 * Ошибки сигнализируются через throw AppException — не через этот DTO.
 *
 * @example
 * return new GeneralApiResponseDto(HttpStatus.OK, HttpStatusDescriptions[HttpStatus.OK], data);
 */
export class GeneralApiResponseDto<T = unknown> {
  readonly statusCode: HttpStatus;
  readonly message: string;
  readonly data?: T;

  constructor(statusCode: HttpStatus, message: string, data?: T) {
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
  }
}
