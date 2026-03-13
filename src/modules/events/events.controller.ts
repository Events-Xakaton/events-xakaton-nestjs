import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { AppRole, Roles } from '@shared/auth';
import { GeneralApiResponseDto } from '@shared/dto';
import { IdResDto, StatusResDto } from '@shared/types';

import {
  CancelEventCommand,
  CreateEventCommand,
  JoinEventCommand,
  SubmitEventFeedbackCommand,
  UnjoinEventCommand,
  UpdateEventCommand,
} from './commands';
import {
  CreateEventReqDto,
  EventFeedbackReqDto,
  UpdateEventReqDto,
} from './dto/request';
import {
  EventDetailResDto,
  EventListItemResDto,
  EventParticipantResDto,
} from './dto/response';
import {
  GetEventQuery,
  GetRandomEventQuery,
  ListEventParticipantsQuery,
  ListEventsQuery,
} from './queries';

@ApiTags('events')
@Roles(AppRole.Member)
@Controller('events')
export class EventsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Список активных событий (upcoming + ongoing)' })
  @ApiResponse({
    status: 200,
    type: [EventListItemResDto],
    description: 'Список событий',
  })
  list(
    @Req() req: Request & { telegramUserId?: string },
  ): Promise<GeneralApiResponseDto<EventListItemResDto[]>> {
    return this.queryBus.execute(new ListEventsQuery(req.telegramUserId));
  }

  @Get('random')
  @ApiOperation({
    summary: 'Случайное событие, в котором пользователь не участвует',
  })
  @ApiResponse({
    status: 200,
    type: IdResDto,
    description: 'ID случайного события',
  })
  @ApiResponse({ status: 404, description: 'Нет подходящих событий' })
  random(
    @Req() req: Request & { telegramUserId?: string },
  ): Promise<GeneralApiResponseDto<IdResDto>> {
    return this.queryBus.execute(new GetRandomEventQuery(req.telegramUserId));
  }

  @Get(':eventId')
  @ApiOperation({ summary: 'Детали события' })
  @ApiParam({ name: 'eventId', description: 'UUID события' })
  @ApiResponse({
    status: 200,
    type: EventDetailResDto,
    description: 'Детали события',
  })
  @ApiResponse({ status: 404, description: 'Событие не найдено' })
  getOne(
    @Req() req: Request & { telegramUserId?: string },
    @Param('eventId') eventId: string,
  ): Promise<GeneralApiResponseDto<EventDetailResDto>> {
    return this.queryBus.execute(
      new GetEventQuery(req.telegramUserId, eventId),
    );
  }

  @Get(':eventId/participants')
  @ApiOperation({ summary: 'Список участников события' })
  @ApiParam({ name: 'eventId', description: 'UUID события' })
  @ApiResponse({
    status: 200,
    type: [EventParticipantResDto],
    description: 'Список участников',
  })
  listParticipants(
    @Req() req: Request & { telegramUserId?: string },
    @Param('eventId') eventId: string,
  ): Promise<GeneralApiResponseDto<EventParticipantResDto[]>> {
    return this.queryBus.execute(
      new ListEventParticipantsQuery(req.telegramUserId, eventId),
    );
  }

  @Post()
  @ApiOperation({ summary: 'Создать событие' })
  @ApiResponse({
    status: 201,
    type: IdResDto,
    description: 'ID созданного события',
  })
  @ApiResponse({
    status: 403,
    description: 'Нет прав создавать события в клубе',
  })
  create(
    @Req() req: Request & { telegramUserId?: string },
    @Body() dto: CreateEventReqDto,
  ): Promise<GeneralApiResponseDto<IdResDto>> {
    return this.commandBus.execute(
      new CreateEventCommand(req.telegramUserId, dto),
    );
  }

  @Post(':eventId/join')
  @ApiOperation({ summary: 'Записаться на событие' })
  @ApiParam({ name: 'eventId', description: 'UUID события' })
  @ApiResponse({
    status: 200,
    type: StatusResDto,
    description: 'Успешная запись на событие',
  })
  @ApiResponse({ status: 400, description: 'Нет мест или неверный статус' })
  @ApiResponse({ status: 404, description: 'Событие не найдено' })
  join(
    @Req() req: Request & { telegramUserId?: string },
    @Param('eventId') eventId: string,
  ): Promise<GeneralApiResponseDto<StatusResDto>> {
    return this.commandBus.execute(
      new JoinEventCommand(req.telegramUserId, eventId),
    );
  }

  @Post(':eventId/unjoin')
  @ApiOperation({ summary: 'Отменить участие в событии' })
  @ApiParam({ name: 'eventId', description: 'UUID события' })
  @ApiResponse({
    status: 200,
    type: StatusResDto,
    description: 'Участие отменено',
  })
  @ApiResponse({ status: 400, description: 'Не является участником' })
  @ApiResponse({ status: 404, description: 'Событие не найдено' })
  unjoin(
    @Req() req: Request & { telegramUserId?: string },
    @Param('eventId') eventId: string,
  ): Promise<GeneralApiResponseDto<StatusResDto>> {
    return this.commandBus.execute(
      new UnjoinEventCommand(req.telegramUserId, eventId),
    );
  }

  @Post(':eventId/feedback')
  @ApiOperation({ summary: 'Оставить отзыв о событии' })
  @ApiParam({ name: 'eventId', description: 'UUID события' })
  @ApiResponse({ status: 200, type: StatusResDto, description: 'Отзыв принят' })
  @ApiResponse({
    status: 400,
    description: 'Окно отзыва закрыто или отзыв уже оставлен',
  })
  @ApiResponse({ status: 404, description: 'Событие не найдено' })
  feedback(
    @Req() req: Request & { telegramUserId?: string },
    @Param('eventId') eventId: string,
    @Body() dto: EventFeedbackReqDto,
  ): Promise<GeneralApiResponseDto<StatusResDto>> {
    return this.commandBus.execute(
      new SubmitEventFeedbackCommand(req.telegramUserId, eventId, dto),
    );
  }

  @Patch(':eventId')
  @ApiOperation({ summary: 'Обновить событие' })
  @ApiParam({ name: 'eventId', description: 'UUID события' })
  @ApiResponse({
    status: 200,
    type: StatusResDto,
    description: 'Событие обновлено',
  })
  @ApiResponse({ status: 403, description: 'Недостаточно прав' })
  @ApiResponse({ status: 404, description: 'Событие не найдено' })
  update(
    @Req() req: Request & { telegramUserId?: string },
    @Param('eventId') eventId: string,
    @Body() dto: UpdateEventReqDto,
  ): Promise<GeneralApiResponseDto<StatusResDto>> {
    return this.commandBus.execute(
      new UpdateEventCommand(req.telegramUserId, eventId, dto),
    );
  }

  @Post(':eventId/cancel')
  @ApiOperation({ summary: 'Отменить событие' })
  @ApiParam({ name: 'eventId', description: 'UUID события' })
  @ApiResponse({
    status: 200,
    type: StatusResDto,
    description: 'Событие отменено',
  })
  @ApiResponse({ status: 403, description: 'Недостаточно прав' })
  @ApiResponse({ status: 404, description: 'Событие не найдено' })
  cancel(
    @Req() req: Request & { telegramUserId?: string },
    @Param('eventId') eventId: string,
  ): Promise<GeneralApiResponseDto<StatusResDto>> {
    return this.commandBus.execute(
      new CancelEventCommand(req.telegramUserId, eventId),
    );
  }
}
