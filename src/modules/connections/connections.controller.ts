import { Controller, Get, Param, Post, Req } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { AppRole, Roles } from '@shared/auth';
import { GeneralApiResponseDto } from '@shared/dto';
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
  async list(
    @Req() req: Request & { telegramUserId?: string },
  ): Promise<GeneralApiResponseDto<FollowingItemResDto[]>> {
    return this.queryBus.execute(new ListFollowingQuery(req.telegramUserId));
  }

  @Post(':targetTelegramUserId/follow')
  @ApiOperation({ summary: 'Подписаться на пользователя' })
  async follow(
    @Req() req: Request & { telegramUserId?: string },
    @Param('targetTelegramUserId') targetTelegramUserId: string,
  ): Promise<GeneralApiResponseDto<StatusResDto>> {
    return this.commandBus.execute(
      new FollowCommand(req.telegramUserId, targetTelegramUserId),
    );
  }

  @Post(':targetTelegramUserId/unfollow')
  @ApiOperation({ summary: 'Отписаться от пользователя' })
  async unfollow(
    @Req() req: Request & { telegramUserId?: string },
    @Param('targetTelegramUserId') targetTelegramUserId: string,
  ): Promise<GeneralApiResponseDto<StatusResDto>> {
    return this.commandBus.execute(
      new UnfollowCommand(req.telegramUserId, targetTelegramUserId),
    );
  }
}
