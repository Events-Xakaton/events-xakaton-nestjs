import { Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';

import { Roles } from '@shared/auth/roles.decorator';
import { GeneralApiResponseDto } from '@shared/dto';

import { MarkNotificationReadCommand } from './commands';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { ListNotificationsQuery } from './queries';

type ApiNotificationType = 'event_changed' | 'member_joined';
type ApiNotificationTargetType = 'club' | 'event';

@ApiTags('notifications')
@Roles('Member')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get()
  @Throttle({ default: { limit: 1500, ttl: 60_000 } })
  @ApiOperation({ summary: 'Список уведомлений с cursor-пагинацией' })
  async list(
    @Req() req: Request & { telegramUserId?: string },
    @Query() query: ListNotificationsDto,
  ): Promise<
    GeneralApiResponseDto<{
      items: Array<{
        id: string;
        type: ApiNotificationType;
        title: string;
        preview: string;
        isRead: boolean;
        createdAt: Date;
        targetType: ApiNotificationTargetType | null;
        targetId: string | null;
        isTargetAvailable: boolean | null;
      }>;
      nextCursor: string | null;
    }>
  > {
    return this.queryBus.execute(
      new ListNotificationsQuery(req.telegramUserId, query),
    );
  }

  @Post(':notificationId/read')
  @ApiOperation({ summary: 'Пометить уведомление как прочитанное' })
  async markRead(
    @Req() req: Request & { telegramUserId?: string },
    @Param('notificationId') notificationId: string,
  ): Promise<GeneralApiResponseDto<{ status: 'ok' }>> {
    return this.commandBus.execute(
      new MarkNotificationReadCommand(req.telegramUserId, notificationId),
    );
  }
}
