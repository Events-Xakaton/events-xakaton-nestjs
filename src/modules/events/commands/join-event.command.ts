export class JoinEventCommand {
  constructor(
    readonly telegramUserId: string | undefined,
    readonly eventId: string,
  ) {}
}
