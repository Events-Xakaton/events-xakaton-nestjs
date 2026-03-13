/** Ответ для команд, создающих ресурс — возвращает его идентификатор. */
export type IdResDto = { id: string };

/** Ответ для команд, изменяющих состояние — возвращает строковый статус операции. */
export type StatusResDto = { status: string };

/** Ответ для команд, результат которых строго фиксирован как 'ok'. */
export type OkStatusResDto = { status: 'ok' };
