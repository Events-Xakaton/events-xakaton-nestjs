import { ApiProperty } from '@nestjs/swagger';

/** Ответ для команд, создающих ресурс — возвращает его идентификатор. */
export class IdResDto {
  @ApiProperty({ description: 'Идентификатор созданного ресурса' })
  declare id: string;
}

/** Ответ для команд, изменяющих состояние — возвращает строковый статус операции. */
export class StatusResDto {
  @ApiProperty({ description: 'Статус выполнения операции' })
  declare status: string;
}

/** Ответ для команд, результат которых строго фиксирован как 'ok'. */
export class OkStatusResDto {
  @ApiProperty({ enum: ['ok'] })
  declare status: 'ok';
}
