export class UnjoinEventCommand {
  constructor(
    readonly telegramUserId: string | undefined,
    readonly eventId: string,
  ) {}
}
