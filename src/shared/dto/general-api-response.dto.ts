import { HttpStatus } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

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
  @ApiProperty({ description: 'HTTP-статус код ответа', enum: HttpStatus })
  readonly statusCode: HttpStatus;

  @ApiProperty({ description: 'Сообщение ответа' })
  readonly message: string;

  @ApiProperty({ description: 'Данные ответа', required: false })
  readonly data?: T;

  constructor(statusCode: HttpStatus, message: string, data?: T) {
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
  }
}
