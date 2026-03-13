export class GetLeaderboardQuery {
  constructor(
    readonly period: 'weekly' | 'monthly',
    readonly telegramUserId: string | undefined,
  ) {}
}
