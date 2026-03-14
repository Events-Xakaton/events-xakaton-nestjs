import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { AppRole, Roles } from '@shared/auth';
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
  @ApiParam({
    name: 'entityType',
    enum: ['club', 'event'],
    description: 'Тип сущности',
  })
  @ApiParam({ name: 'entityId', description: 'UUID сущности' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: [CommentItemResDto],
    description: 'Список комментариев',
  })
  async list(
    @Param('entityType') entityType: 'club' | 'event',
    @Param('entityId') entityId: string,
  ): Promise<CommentItemResDto[]> {
    return this.queryBus.execute(new ListCommentsQuery(entityType, entityId));
  }

  @Post()
  @ApiOperation({ summary: 'Создать комментарий' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: IdResDto,
    description: 'ID созданного комментария',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Сущность не найдена',
  })
  async create(
    @Req() req: Request & { telegramUserId?: string },
    @Body() dto: CreateCommentReqDto,
  ): Promise<IdResDto> {
    return this.commandBus.execute(
      new CreateCommentCommand(req.telegramUserId, dto),
    );
  }

  @Post(':commentId/edit')
  @ApiOperation({ summary: 'Редактировать комментарий (только автор)' })
  @ApiParam({ name: 'commentId', description: 'UUID комментария' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: StatusResDto,
    description: 'Комментарий обновлён',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Не автор комментария',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Комментарий не найден',
  })
  async edit(
    @Req() req: Request & { telegramUserId?: string },
    @Param('commentId') commentId: string,
    @Body() dto: UpdateCommentReqDto,
  ): Promise<StatusResDto> {
    return this.commandBus.execute(
      new UpdateCommentCommand(req.telegramUserId, commentId, dto),
    );
  }

  @Delete(':commentId')
  @ApiOperation({ summary: 'Удалить комментарий (только автор)' })
  @ApiParam({ name: 'commentId', description: 'UUID комментария' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: StatusResDto,
    description: 'Комментарий удалён',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Не автор комментария',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Комментарий не найден',
  })
  async remove(
    @Req() req: Request & { telegramUserId?: string },
    @Param('commentId') commentId: string,
  ): Promise<StatusResDto> {
    return this.commandBus.execute(
      new DeleteCommentCommand(req.telegramUserId, commentId),
    );
  }
}
