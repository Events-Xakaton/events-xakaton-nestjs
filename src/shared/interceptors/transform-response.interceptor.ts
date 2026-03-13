import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { GeneralApiResponseDto } from '@shared/dto';

/**
 * Глобальный интерцептор преобразования ответов.
 *
 * Перехватывает GeneralApiResponseDto от handlers:
 * - statusCode 200 или 201 → пропускает как есть
 * - любой другой statusCode → бросает HttpException, который
 *   подхватывает HttpExceptionFilter и форматирует в единый JSON-ответ
 *
 * Благодаря этому handlers никогда не бросают исключений напрямую —
 * все результаты (успех и ошибка) возвращаются через GeneralApiResponseDto.
 */
@Injectable()
export class TransformResponseInterceptor<T> implements NestInterceptor<
  GeneralApiResponseDto<T>,
  GeneralApiResponseDto<T>
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<GeneralApiResponseDto<T>>,
  ): Observable<GeneralApiResponseDto<T>> {
    return next.handle().pipe(
      map((response) => {
        if (
          response instanceof GeneralApiResponseDto &&
          (response.statusCode as number) !== 200 &&
          (response.statusCode as number) !== 201
        ) {
          // response.error содержит специфическое сообщение (например, 'Пользователь не найден').
          // Передаём его в HttpException целиком, чтобы GeneralExceptionFilter мог его извлечь.
          throw new HttpException(
            response.error ?? response.message,
            response.statusCode,
          );
        }

        return response;
      }),
    );
  }
}
