export class GetClubQuery {
  constructor(
    public readonly telegramUserId: string | undefined,
    public readonly clubId: string,
  ) {}
}
