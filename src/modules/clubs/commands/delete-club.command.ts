export class DeleteClubCommand {
  constructor(
    public readonly telegramUserId: string | undefined,
    public readonly clubId: string,
  ) {}
}
