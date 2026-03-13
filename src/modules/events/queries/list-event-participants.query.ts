export class ListEventParticipantsQuery {
  constructor(
    readonly telegramUserId: string | undefined,
    readonly eventId: string,
  ) {}
}
