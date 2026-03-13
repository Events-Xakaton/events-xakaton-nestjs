export class CancelEventCommand {
  constructor(
    readonly telegramUserId: string | undefined,
    readonly eventId: string,
  ) {}
}
