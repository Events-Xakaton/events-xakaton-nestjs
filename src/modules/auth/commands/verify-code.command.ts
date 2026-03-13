export class VerifyCodeCommand {
  constructor(
    readonly telegramUserId: string,
    readonly reddyUserKey: string,
    readonly code: string,
  ) {}
}
