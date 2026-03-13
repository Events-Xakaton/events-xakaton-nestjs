export class GetEventQuery {
  constructor(
    readonly telegramUserId: string | undefined,
    readonly eventId: string,
  ) {}
}
