export class ListClubMembersQuery {
  constructor(
    public readonly telegramUserId: string | undefined,
    public readonly clubId: string,
  ) {}
}
