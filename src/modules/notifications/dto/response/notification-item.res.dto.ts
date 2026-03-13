export type ApiNotificationType = 'event_changed' | 'member_joined';
export type ApiNotificationTargetType = 'club' | 'event';

export type NotificationItemResDto = {
  id: string;
  type: ApiNotificationType;
  title: string;
  preview: string;
  isRead: boolean;
  createdAt: Date;
  targetType: ApiNotificationTargetType | null;
  targetId: string | null;
  isTargetAvailable: boolean | null;
};
