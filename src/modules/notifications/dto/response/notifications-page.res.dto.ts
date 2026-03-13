import { ApiProperty } from '@nestjs/swagger';

import { NotificationItemResDto } from './notification-item.res.dto';

export class NotificationsPageResDto {
  @ApiProperty({
    type: [NotificationItemResDto],
    description: 'Список уведомлений',
  })
  declare items: NotificationItemResDto[];

  @ApiProperty({ nullable: true, description: 'Курсор для следующей страницы' })
  declare nextCursor: string | null;
}
