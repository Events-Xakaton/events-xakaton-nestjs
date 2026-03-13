export class DeleteCommentCommand {
  constructor(
    readonly telegramUserId: string | undefined,
    readonly commentId: string,
  ) {}
}
