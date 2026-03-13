import { EventStatus } from '@shared/domain';

export class ListClubEventsQuery {
  constructor(
    public readonly telegramUserId: string | undefined,
    public readonly clubId: string,
    public readonly bucket:
      | EventStatus.Upcoming
      | EventStatus.Ongoing
      | EventStatus.Past
      | undefined,
    public readonly page: number | undefined,
    public readonly limit: number | undefined,
  ) {}
}
