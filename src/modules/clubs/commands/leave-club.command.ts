export class LeaveClubCommand {
  constructor(
    public readonly telegramUserId: string | undefined,
    public readonly clubId: string,
  ) {}
}
