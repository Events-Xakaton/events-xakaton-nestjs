import {
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';

import { AppRole, Roles } from '@shared/auth';
import { GeneralApiResponseDto } from '@shared/dto';
import { OkStatusResDto } from '@shared/types';

import { MarkNotificationReadCommand } from './commands';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { NotificationsPageResDto } from './dto/response';
import { ListNotificationsQuery } from './queries';

@ApiTags('notifications')
@Roles(AppRole.Member)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get()
  @Throttle({ default: { limit: 1500, ttl: 60_000 } })
  @ApiOperation({ summary: 'Список уведомлений с cursor-пагинацией' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: NotificationsPageResDto,
    description: 'Страница уведомлений',
  })
  async list(
    @Req() req: Request & { telegramUserId?: string },
    @Query() query: ListNotificationsDto,
  ): Promise<GeneralApiResponseDto<NotificationsPageResDto>> {
    return this.queryBus.execute(
      new ListNotificationsQuery(req.telegramUserId, query),
    );
  }

  @Post(':notificationId/read')
  @ApiOperation({ summary: 'Пометить уведомление как прочитанное' })
  @ApiParam({ name: 'notificationId', description: 'UUID уведомления' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: OkStatusResDto,
    description: 'Уведомление помечено прочитанным',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Уведомление не найдено',
  })
  async markRead(
    @Req() req: Request & { telegramUserId?: string },
    @Param('notificationId') notificationId: string,
  ): Promise<GeneralApiResponseDto<OkStatusResDto>> {
    return this.commandBus.execute(
      new MarkNotificationReadCommand(req.telegramUserId, notificationId),
    );
  }
}
