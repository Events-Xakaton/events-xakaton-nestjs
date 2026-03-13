import { ListNotificationsDto } from '../dto/list-notifications.dto';

export class ListNotificationsQuery {
  constructor(
    readonly telegramUserId: string | undefined,
    readonly dto: ListNotificationsDto,
  ) {}
}
