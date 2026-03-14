import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { AppRole, Roles } from '@shared/auth';
import { IdResDto, StatusResDto } from '@shared/types';

import {
  CancelEventCommand,
  ConfirmAttendanceCommand,
  CreateEventCommand,
  JoinEventCommand,
  SubmitEventFeedbackCommand,
  UnjoinEventCommand,
  UpdateEventCommand,
} from './commands';
import {
  ConfirmAttendanceReqDto,
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
    status: HttpStatus.OK,
    type: [EventListItemResDto],
    description: 'Список событий',
  })
  list(
    @Req() req: Request & { telegramUserId?: string },
  ): Promise<EventListItemResDto[]> {
    return this.queryBus.execute(new ListEventsQuery(req.telegramUserId));
  }

  @Get('random')
  @ApiOperation({
    summary: 'Lucky Wheel: предопределённое случайное событие для пользователя',
    description:
      'Выбирает одно доступное upcoming-событие из окна ближайших K=5. ' +
      'Пользователь не должен быть участником, должны быть свободные места. ' +
      'Лимит: 1 запуск в UTC-день.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: IdResDto,
    description: 'ID выбранного события',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description:
      'Нет доступных событий или исчерпан дневной лимит. ' +
      'Поле `message` содержит машиночитаемый код: ' +
      '`NO_ELIGIBLE_EVENTS` — нет подходящих событий; ' +
      '`DAILY_LIMIT_REACHED` — лимит 1 запуск/день исчерпан.',
  })
  random(
    @Req() req: Request & { telegramUserId?: string },
  ): Promise<IdResDto> {
    return this.queryBus.execute(new GetRandomEventQuery(req.telegramUserId));
  }

  @Get(':eventId')
  @ApiOperation({ summary: 'Детали события' })
  @ApiParam({ name: 'eventId', description: 'UUID события' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: EventDetailResDto,
    description: 'Детали события',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Событие не найдено',
  })
  getOne(
    @Req() req: Request & { telegramUserId?: string },
    @Param('eventId') eventId: string,
  ): Promise<EventDetailResDto> {
    return this.queryBus.execute(
      new GetEventQuery(req.telegramUserId, eventId),
    );
  }

  @Get(':eventId/participants')
  @ApiOperation({ summary: 'Список участников события' })
  @ApiParam({ name: 'eventId', description: 'UUID события' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: [EventParticipantResDto],
    description: 'Список участников',
  })
  listParticipants(
    @Req() req: Request & { telegramUserId?: string },
    @Param('eventId') eventId: string,
  ): Promise<EventParticipantResDto[]> {
    return this.queryBus.execute(
      new ListEventParticipantsQuery(req.telegramUserId, eventId),
    );
  }

  @Post()
  @ApiOperation({ summary: 'Создать событие' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: IdResDto,
    description: 'ID созданного события',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Нет прав создавать события в клубе',
  })
  create(
    @Req() req: Request & { telegramUserId?: string },
    @Body() dto: CreateEventReqDto,
  ): Promise<IdResDto> {
    return this.commandBus.execute(
      new CreateEventCommand(req.telegramUserId, dto),
    );
  }

  @Post(':eventId/join')
  @ApiOperation({ summary: 'Записаться на событие' })
  @ApiParam({ name: 'eventId', description: 'UUID события' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: StatusResDto,
    description: 'Успешная запись на событие',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Нет мест или неверный статус',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Событие не найдено',
  })
  join(
    @Req() req: Request & { telegramUserId?: string },
    @Param('eventId') eventId: string,
  ): Promise<StatusResDto> {
    return this.commandBus.execute(
      new JoinEventCommand(req.telegramUserId, eventId),
    );
  }

  @Post(':eventId/unjoin')
  @ApiOperation({ summary: 'Отменить участие в событии' })
  @ApiParam({ name: 'eventId', description: 'UUID события' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: StatusResDto,
    description: 'Участие отменено',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Не является участником',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Событие не найдено',
  })
  unjoin(
    @Req() req: Request & { telegramUserId?: string },
    @Param('eventId') eventId: string,
  ): Promise<StatusResDto> {
    return this.commandBus.execute(
      new UnjoinEventCommand(req.telegramUserId, eventId),
    );
  }

  @Post(':eventId/feedback')
  @ApiOperation({ summary: 'Оставить отзыв о событии' })
  @ApiParam({ name: 'eventId', description: 'UUID события' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: StatusResDto,
    description: 'Отзыв принят',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Окно отзыва закрыто или отзыв уже оставлен',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Событие не найдено',
  })
  feedback(
    @Req() req: Request & { telegramUserId?: string },
    @Param('eventId') eventId: string,
    @Body() dto: EventFeedbackReqDto,
  ): Promise<StatusResDto> {
    return this.commandBus.execute(
      new SubmitEventFeedbackCommand(req.telegramUserId, eventId, dto),
    );
  }

  @Patch(':eventId')
  @ApiOperation({ summary: 'Обновить событие' })
  @ApiParam({ name: 'eventId', description: 'UUID события' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: StatusResDto,
    description: 'Событие обновлено',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Недостаточно прав',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Событие не найдено',
  })
  update(
    @Req() req: Request & { telegramUserId?: string },
    @Param('eventId') eventId: string,
    @Body() dto: UpdateEventReqDto,
  ): Promise<StatusResDto> {
    return this.commandBus.execute(
      new UpdateEventCommand(req.telegramUserId, eventId, dto),
    );
  }

  @Post(':eventId/attendance')
  @ApiOperation({ summary: 'Подтвердить присутствие участников и выставить оценки' })
  @ApiParam({ name: 'eventId', description: 'UUID события' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: StatusResDto,
    description: 'Подтверждения применены',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Событие не в статусе past или пустой список',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Не создатель события',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Событие не найдено',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Подтверждения уже были отправлены',
  })
  confirmAttendance(
    @Req() req: Request & { telegramUserId?: string },
    @Param('eventId') eventId: string,
    @Body() dto: ConfirmAttendanceReqDto,
  ): Promise<StatusResDto> {
    return this.commandBus.execute(
      new ConfirmAttendanceCommand(req.telegramUserId, eventId, dto),
    );
  }

  @Post(':eventId/cancel')
  @ApiOperation({ summary: 'Отменить событие' })
  @ApiParam({ name: 'eventId', description: 'UUID события' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: StatusResDto,
    description: 'Событие отменено',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Недостаточно прав',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Событие не найдено',
  })
  cancel(
    @Req() req: Request & { telegramUserId?: string },
    @Param('eventId') eventId: string,
  ): Promise<StatusResDto> {
    return this.commandBus.execute(
      new CancelEventCommand(req.telegramUserId, eventId),
    );
  }
}
