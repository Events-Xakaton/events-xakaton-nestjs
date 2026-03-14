import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { AppRole, Roles } from '@shared/auth';
import { IdResDto, StatusResDto } from '@shared/types';

import {
  CreateClubCommand,
  DeleteClubCommand,
  JoinClubCommand,
  LeaveClubCommand,
  UpdateClubCommand,
} from './commands';
import {
  CreateClubReqDto,
  ListClubEventsReqDto,
  UpdateClubReqDto,
} from './dto/request';
import {
  ClubAuthoringItemResDto,
  ClubDetailResDto,
  ClubEventsPageResDto,
  ClubListItemResDto,
  ClubMemberResDto,
} from './dto/response';
import {
  GetClubQuery,
  ListClubEventsQuery,
  ListClubMembersQuery,
  ListClubsQuery,
  ListEventAuthoringClubsQuery,
} from './queries';

@ApiTags('clubs')
@Roles(AppRole.Member)
@Controller('clubs')
export class ClubsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Список клубов' })
  @ApiResponse({ status: HttpStatus.OK, type: [ClubListItemResDto] })
  list(
    @Req() req: Request & { telegramUserId?: string },
  ): Promise<ClubListItemResDto[]> {
    return this.queryBus.execute(new ListClubsQuery(req.telegramUserId));
  }

  @Get('meta/event-authoring')
  @ApiOperation({
    summary: 'Клубы, в которых пользователь может создавать события',
  })
  @ApiResponse({ status: HttpStatus.OK, type: [ClubAuthoringItemResDto] })
  listEventAuthoringClubs(
    @Req() req: Request & { telegramUserId?: string },
  ): Promise<ClubAuthoringItemResDto[]> {
    return this.queryBus.execute(
      new ListEventAuthoringClubsQuery(req.telegramUserId),
    );
  }

  @Get(':clubId')
  @ApiOperation({ summary: 'Детали клуба' })
  @ApiParam({ name: 'clubId', description: 'UUID клуба' })
  @ApiResponse({ status: HttpStatus.OK, type: ClubDetailResDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Клуб не найден' })
  getOne(
    @Req() req: Request & { telegramUserId?: string },
    @Param('clubId') clubId: string,
  ): Promise<ClubDetailResDto> {
    return this.queryBus.execute(new GetClubQuery(req.telegramUserId, clubId));
  }

  @Get(':clubId/members')
  @ApiOperation({ summary: 'Участники клуба' })
  @ApiParam({ name: 'clubId', description: 'UUID клуба' })
  @ApiResponse({ status: HttpStatus.OK, type: [ClubMemberResDto] })
  listMembers(
    @Req() req: Request & { telegramUserId?: string },
    @Param('clubId') clubId: string,
  ): Promise<ClubMemberResDto[]> {
    return this.queryBus.execute(
      new ListClubMembersQuery(req.telegramUserId, clubId),
    );
  }

  @Get(':clubId/events')
  @ApiOperation({ summary: 'События клуба с пагинацией' })
  @ApiParam({ name: 'clubId', description: 'UUID клуба' })
  @ApiResponse({ status: HttpStatus.OK, type: ClubEventsPageResDto })
  listClubEvents(
    @Req() req: Request & { telegramUserId?: string },
    @Param('clubId') clubId: string,
    @Query() queryDto: ListClubEventsReqDto,
  ): Promise<ClubEventsPageResDto> {
    return this.queryBus.execute(
      new ListClubEventsQuery(
        req.telegramUserId,
        clubId,
        queryDto.bucket,
        queryDto.page,
        queryDto.limit,
      ),
    );
  }

  @Post()
  @ApiOperation({ summary: 'Создать клуб' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: IdResDto,
    description: 'ID созданного клуба',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Клуб с таким названием уже существует',
  })
  create(
    @Req() req: Request & { telegramUserId?: string },
    @Body() dto: CreateClubReqDto,
  ): Promise<IdResDto> {
    return this.commandBus.execute(
      new CreateClubCommand(req.telegramUserId, dto),
    );
  }

  @Post(':clubId/join')
  @ApiOperation({ summary: 'Вступить в клуб' })
  @ApiParam({ name: 'clubId', description: 'UUID клуба' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: StatusResDto,
    description: 'Успешное вступление',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Уже состоит в клубе',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Клуб не найден' })
  join(
    @Req() req: Request & { telegramUserId?: string },
    @Param('clubId') clubId: string,
  ): Promise<StatusResDto> {
    return this.commandBus.execute(
      new JoinClubCommand(req.telegramUserId, clubId),
    );
  }

  @Post(':clubId/leave')
  @ApiOperation({ summary: 'Покинуть клуб' })
  @ApiParam({ name: 'clubId', description: 'UUID клуба' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: StatusResDto,
    description: 'Успешный выход из клуба',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Не состоит в клубе или является владельцем',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Клуб не найден' })
  leave(
    @Req() req: Request & { telegramUserId?: string },
    @Param('clubId') clubId: string,
  ): Promise<StatusResDto> {
    return this.commandBus.execute(
      new LeaveClubCommand(req.telegramUserId, clubId),
    );
  }

  @Patch(':clubId')
  @ApiOperation({ summary: 'Обновить клуб' })
  @ApiParam({ name: 'clubId', description: 'UUID клуба' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: StatusResDto,
    description: 'Клуб обновлён',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Недостаточно прав',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Клуб не найден' })
  update(
    @Req() req: Request & { telegramUserId?: string },
    @Param('clubId') clubId: string,
    @Body() dto: UpdateClubReqDto,
  ): Promise<StatusResDto> {
    return this.commandBus.execute(
      new UpdateClubCommand(req.telegramUserId, clubId, dto),
    );
  }

  @Delete(':clubId')
  @ApiOperation({ summary: 'Удалить клуб (soft delete)' })
  @ApiParam({ name: 'clubId', description: 'UUID клуба' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: StatusResDto,
    description: 'Клуб удалён',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Недостаточно прав',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Клуб не найден' })
  delete(
    @Req() req: Request & { telegramUserId?: string },
    @Param('clubId') clubId: string,
  ): Promise<StatusResDto> {
    return this.commandBus.execute(
      new DeleteClubCommand(req.telegramUserId, clubId),
    );
  }
}
