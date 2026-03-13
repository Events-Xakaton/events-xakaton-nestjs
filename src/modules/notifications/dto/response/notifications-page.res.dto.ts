import { NotificationItemResDto } from './notification-item.res.dto';

export type NotificationsPageResDto = {
  items: NotificationItemResDto[];
  nextCursor: string | null;
};
