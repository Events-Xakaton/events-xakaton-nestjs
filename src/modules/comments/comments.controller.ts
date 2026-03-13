import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { AppRole, Roles } from '@shared/auth';
import { GeneralApiResponseDto } from '@shared/dto';
import { IdResDto, StatusResDto } from '@shared/types';

import {
  CreateCommentCommand,
  DeleteCommentCommand,
  UpdateCommentCommand,
} from './commands';
import { CreateCommentReqDto, UpdateCommentReqDto } from './dto/request';
import { CommentItemResDto } from './dto/response';
import { ListCommentsQuery } from './queries';

@ApiTags('comments')
@Roles(AppRole.Member)
@Controller('comments')
export class CommentsController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get(':entityType/:entityId')
  @ApiOperation({ summary: 'Список комментариев сущности (club/event)' })
  async list(
    @Param('entityType') entityType: 'club' | 'event',
    @Param('entityId') entityId: string,
  ): Promise<GeneralApiResponseDto<CommentItemResDto[]>> {
    return this.queryBus.execute(new ListCommentsQuery(entityType, entityId));
  }

  @Post()
  @ApiOperation({ summary: 'Создать комментарий' })
  async create(
    @Req() req: Request & { telegramUserId?: string },
    @Body() dto: CreateCommentReqDto,
  ): Promise<GeneralApiResponseDto<IdResDto>> {
    return this.commandBus.execute(
      new CreateCommentCommand(req.telegramUserId, dto),
    );
  }

  @Post(':commentId/edit')
  @ApiOperation({ summary: 'Редактировать комментарий (только автор)' })
  async edit(
    @Req() req: Request & { telegramUserId?: string },
    @Param('commentId') commentId: string,
    @Body() dto: UpdateCommentReqDto,
  ): Promise<GeneralApiResponseDto<StatusResDto>> {
    return this.commandBus.execute(
      new UpdateCommentCommand(req.telegramUserId, commentId, dto),
    );
  }

  @Delete(':commentId')
  @ApiOperation({ summary: 'Удалить комментарий (только автор)' })
  async remove(
    @Req() req: Request & { telegramUserId?: string },
    @Param('commentId') commentId: string,
  ): Promise<GeneralApiResponseDto<StatusResDto>> {
    return this.commandBus.execute(
      new DeleteCommentCommand(req.telegramUserId, commentId),
    );
  }
}
