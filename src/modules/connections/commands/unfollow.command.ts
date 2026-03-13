export class UnfollowCommand {
  constructor(
    readonly telegramUserId: string | undefined,
    readonly targetTelegramUserId: string,
  ) {}
}
