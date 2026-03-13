export class FollowCommand {
  constructor(
    readonly telegramUserId: string | undefined,
    readonly targetTelegramUserId: string,
  ) {}
}
