export class MarkNotificationReadCommand {
  constructor(
    readonly telegramUserId: string | undefined,
    readonly notificationId: string,
  ) {}
}
