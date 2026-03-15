export class JoinEventCommand {
  constructor(
    readonly telegramUserId: string | undefined,
    readonly eventId: string,
    /** Флаг Lucky Wheel — обходит проверку minLevel для случайного события */
    readonly lucky: boolean = false,
  ) {}
}
