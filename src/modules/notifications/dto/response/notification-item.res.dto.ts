import { ApiProperty } from '@nestjs/swagger';

export type ApiNotificationType = 'event_changed' | 'member_joined';
export type ApiNotificationTargetType = 'club' | 'event';

export class NotificationItemResDto {
  @ApiProperty({ description: 'ID уведомления' })
  declare id: string;

  @ApiProperty({
    enum: ['event_changed', 'member_joined'],
    description: 'Тип уведомления',
  })
  declare type: ApiNotificationType;

  @ApiProperty({ description: 'Заголовок уведомления' })
  declare title: string;

  @ApiProperty({ description: 'Краткий текст уведомления' })
  declare preview: string;

  @ApiProperty({ description: 'Прочитано ли уведомление' })
  declare isRead: boolean;

  @ApiProperty({ description: 'Дата создания' })
  declare createdAt: Date;

  @ApiProperty({
    enum: ['club', 'event'],
    nullable: true,
    description: 'Тип связанной сущности',
  })
  declare targetType: ApiNotificationTargetType | null;

  @ApiProperty({ nullable: true, description: 'ID связанной сущности' })
  declare targetId: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Доступна ли связанная сущность (не удалена)',
  })
  declare isTargetAvailable: boolean | null;
}
