import { Controller, Get, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { AppRole, Roles } from '@shared/auth';
import { StatusResDto } from '@shared/types';

import { FollowCommand, UnfollowCommand } from './commands';
import { FollowingItemResDto } from './dto/response';
import { ListFollowingQuery } from './queries';

@ApiTags('connections')
@Roles(AppRole.Member)
@Controller('connections')
export class ConnectionsController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Список подписок текущего пользователя' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: [FollowingItemResDto],
    description: 'Список подписок',
  })
  async list(
    @Req() req: Request & { telegramUserId?: string },
  ): Promise<FollowingItemResDto[]> {
    return this.queryBus.execute(new ListFollowingQuery(req.telegramUserId));
  }

  @Post(':targetTelegramUserId/follow')
  @ApiOperation({ summary: 'Подписаться на пользователя' })
  @ApiParam({
    name: 'targetTelegramUserId',
    description: 'Telegram ID целевого пользователя',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: StatusResDto,
    description: 'Подписка оформлена',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Уже подписан или попытка подписаться на себя',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Пользователь не найден',
  })
  async follow(
    @Req() req: Request & { telegramUserId?: string },
    @Param('targetTelegramUserId') targetTelegramUserId: string,
  ): Promise<StatusResDto> {
    return this.commandBus.execute(
      new FollowCommand(req.telegramUserId, targetTelegramUserId),
    );
  }

  @Post(':targetTelegramUserId/unfollow')
  @ApiOperation({ summary: 'Отписаться от пользователя' })
  @ApiParam({
    name: 'targetTelegramUserId',
    description: 'Telegram ID целевого пользователя',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: StatusResDto,
    description: 'Отписка выполнена',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Подписка не существует',
  })
  async unfollow(
    @Req() req: Request & { telegramUserId?: string },
    @Param('targetTelegramUserId') targetTelegramUserId: string,
  ): Promise<StatusResDto> {
    return this.commandBus.execute(
      new UnfollowCommand(req.telegramUserId, targetTelegramUserId),
    );
  }
}
