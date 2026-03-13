export class ListClubEventsQuery {
  constructor(
    public readonly telegramUserId: string | undefined,
    public readonly clubId: string,
    public readonly bucket: 'upcoming' | 'ongoing' | 'past' | undefined,
    public readonly page: number | undefined,
    public readonly limit: number | undefined,
  ) {}
}
