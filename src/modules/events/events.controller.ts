import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { AppRole, Roles } from '@shared/auth';
import { GeneralApiResponseDto } from '@shared/dto';

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
  @ApiResponse({ status: 200, type: [EventListItemResDto] })
  list(
    @Req() req: Request & { telegramUserId?: string },
  ): Promise<GeneralApiResponseDto<EventListItemResDto[]>> {
    return this.queryBus.execute(new ListEventsQuery(req.telegramUserId));
  }

  @Get('random')
  @ApiOperation({
    summary: 'Случайное событие, в котором пользователь не участвует',
  })
  @ApiResponse({ status: 404, description: 'Нет подходящих событий' })
  random(
    @Req() req: Request & { telegramUserId?: string },
  ): Promise<GeneralApiResponseDto<{ id: string }>> {
    return this.queryBus.execute(new GetRandomEventQuery(req.telegramUserId));
  }

  @Get(':eventId')
  @ApiOperation({ summary: 'Детали события' })
  @ApiResponse({ status: 200, type: EventDetailResDto })
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
  @ApiResponse({ status: 200, type: [EventParticipantResDto] })
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
  @ApiResponse({ status: 201, description: 'ID созданного события' })
  create(
    @Req() req: Request & { telegramUserId?: string },
    @Body() dto: CreateEventReqDto,
  ): Promise<GeneralApiResponseDto<{ id: string }>> {
    return this.commandBus.execute(
      new CreateEventCommand(req.telegramUserId, dto),
    );
  }

  @Post(':eventId/join')
  @ApiOperation({ summary: 'Записаться на событие' })
  @ApiResponse({ status: 400, description: 'Нет мест или неверный статус' })
  join(
    @Req() req: Request & { telegramUserId?: string },
    @Param('eventId') eventId: string,
  ): Promise<GeneralApiResponseDto<{ status: string }>> {
    return this.commandBus.execute(
      new JoinEventCommand(req.telegramUserId, eventId),
    );
  }

  @Post(':eventId/unjoin')
  @ApiOperation({ summary: 'Отменить участие в событии' })
  unjoin(
    @Req() req: Request & { telegramUserId?: string },
    @Param('eventId') eventId: string,
  ): Promise<GeneralApiResponseDto<{ status: string }>> {
    return this.commandBus.execute(
      new UnjoinEventCommand(req.telegramUserId, eventId),
    );
  }

  @Post(':eventId/feedback')
  @ApiOperation({ summary: 'Оставить отзыв о событии' })
  @ApiResponse({ status: 400, description: 'Окно отзыва закрыто' })
  feedback(
    @Req() req: Request & { telegramUserId?: string },
    @Param('eventId') eventId: string,
    @Body() dto: EventFeedbackReqDto,
  ): Promise<GeneralApiResponseDto<{ status: string }>> {
    return this.commandBus.execute(
      new SubmitEventFeedbackCommand(req.telegramUserId, eventId, dto),
    );
  }

  @Patch(':eventId')
  @ApiOperation({ summary: 'Обновить событие' })
  @ApiResponse({ status: 403, description: 'Недостаточно прав' })
  update(
    @Req() req: Request & { telegramUserId?: string },
    @Param('eventId') eventId: string,
    @Body() dto: UpdateEventReqDto,
  ): Promise<GeneralApiResponseDto<{ status: string }>> {
    return this.commandBus.execute(
      new UpdateEventCommand(req.telegramUserId, eventId, dto),
    );
  }

  @Post(':eventId/cancel')
  @ApiOperation({ summary: 'Отменить событие' })
  @ApiResponse({ status: 403, description: 'Недостаточно прав' })
  cancel(
    @Req() req: Request & { telegramUserId?: string },
    @Param('eventId') eventId: string,
  ): Promise<GeneralApiResponseDto<{ status: string }>> {
    return this.commandBus.execute(
      new CancelEventCommand(req.telegramUserId, eventId),
    );
  }
}
