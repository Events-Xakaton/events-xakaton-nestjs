export class SetActiveAchievementCommand {
  constructor(
    readonly telegramUserId: string | undefined,
    readonly achievementId: string | null,
  ) {}
}
