import {
  Body,
  Controller,
  Delete,
  Get,
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
import { GeneralApiResponseDto } from '@shared/dto';
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
  @ApiResponse({ status: 200, type: [ClubListItemResDto] })
  list(
    @Req() req: Request & { telegramUserId?: string },
  ): Promise<GeneralApiResponseDto<ClubListItemResDto[]>> {
    return this.queryBus.execute(new ListClubsQuery(req.telegramUserId));
  }

  @Get('meta/event-authoring')
  @ApiOperation({
    summary: 'Клубы, в которых пользователь может создавать события',
  })
  @ApiResponse({ status: 200, type: [ClubAuthoringItemResDto] })
  listEventAuthoringClubs(
    @Req() req: Request & { telegramUserId?: string },
  ): Promise<GeneralApiResponseDto<ClubAuthoringItemResDto[]>> {
    return this.queryBus.execute(
      new ListEventAuthoringClubsQuery(req.telegramUserId),
    );
  }

  @Get(':clubId')
  @ApiOperation({ summary: 'Детали клуба' })
  @ApiParam({ name: 'clubId', description: 'UUID клуба' })
  @ApiResponse({ status: 200, type: ClubDetailResDto })
  @ApiResponse({ status: 404, description: 'Клуб не найден' })
  getOne(
    @Req() req: Request & { telegramUserId?: string },
    @Param('clubId') clubId: string,
  ): Promise<GeneralApiResponseDto<ClubDetailResDto>> {
    return this.queryBus.execute(new GetClubQuery(req.telegramUserId, clubId));
  }

  @Get(':clubId/members')
  @ApiOperation({ summary: 'Участники клуба' })
  @ApiParam({ name: 'clubId', description: 'UUID клуба' })
  @ApiResponse({ status: 200, type: [ClubMemberResDto] })
  listMembers(
    @Req() req: Request & { telegramUserId?: string },
    @Param('clubId') clubId: string,
  ): Promise<GeneralApiResponseDto<ClubMemberResDto[]>> {
    return this.queryBus.execute(
      new ListClubMembersQuery(req.telegramUserId, clubId),
    );
  }

  @Get(':clubId/events')
  @ApiOperation({ summary: 'События клуба с пагинацией' })
  @ApiParam({ name: 'clubId', description: 'UUID клуба' })
  @ApiResponse({ status: 200, type: ClubEventsPageResDto })
  listClubEvents(
    @Req() req: Request & { telegramUserId?: string },
    @Param('clubId') clubId: string,
    @Query() queryDto: ListClubEventsReqDto,
  ): Promise<GeneralApiResponseDto<ClubEventsPageResDto>> {
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
    status: 201,
    type: IdResDto,
    description: 'ID созданного клуба',
  })
  @ApiResponse({
    status: 409,
    description: 'Клуб с таким названием уже существует',
  })
  create(
    @Req() req: Request & { telegramUserId?: string },
    @Body() dto: CreateClubReqDto,
  ): Promise<GeneralApiResponseDto<IdResDto>> {
    return this.commandBus.execute(
      new CreateClubCommand(req.telegramUserId, dto),
    );
  }

  @Post(':clubId/join')
  @ApiOperation({ summary: 'Вступить в клуб' })
  @ApiParam({ name: 'clubId', description: 'UUID клуба' })
  @ApiResponse({
    status: 200,
    type: StatusResDto,
    description: 'Успешное вступление',
  })
  @ApiResponse({ status: 400, description: 'Уже состоит в клубе' })
  @ApiResponse({ status: 404, description: 'Клуб не найден' })
  join(
    @Req() req: Request & { telegramUserId?: string },
    @Param('clubId') clubId: string,
  ): Promise<GeneralApiResponseDto<StatusResDto>> {
    return this.commandBus.execute(
      new JoinClubCommand(req.telegramUserId, clubId),
    );
  }

  @Post(':clubId/leave')
  @ApiOperation({ summary: 'Покинуть клуб' })
  @ApiParam({ name: 'clubId', description: 'UUID клуба' })
  @ApiResponse({
    status: 200,
    type: StatusResDto,
    description: 'Успешный выход из клуба',
  })
  @ApiResponse({
    status: 400,
    description: 'Не состоит в клубе или является владельцем',
  })
  @ApiResponse({ status: 404, description: 'Клуб не найден' })
  leave(
    @Req() req: Request & { telegramUserId?: string },
    @Param('clubId') clubId: string,
  ): Promise<GeneralApiResponseDto<StatusResDto>> {
    return this.commandBus.execute(
      new LeaveClubCommand(req.telegramUserId, clubId),
    );
  }

  @Patch(':clubId')
  @ApiOperation({ summary: 'Обновить клуб' })
  @ApiParam({ name: 'clubId', description: 'UUID клуба' })
  @ApiResponse({
    status: 200,
    type: StatusResDto,
    description: 'Клуб обновлён',
  })
  @ApiResponse({ status: 403, description: 'Недостаточно прав' })
  @ApiResponse({ status: 404, description: 'Клуб не найден' })
  update(
    @Req() req: Request & { telegramUserId?: string },
    @Param('clubId') clubId: string,
    @Body() dto: UpdateClubReqDto,
  ): Promise<GeneralApiResponseDto<StatusResDto>> {
    return this.commandBus.execute(
      new UpdateClubCommand(req.telegramUserId, clubId, dto),
    );
  }

  @Delete(':clubId')
  @ApiOperation({ summary: 'Удалить клуб (soft delete)' })
  @ApiParam({ name: 'clubId', description: 'UUID клуба' })
  @ApiResponse({ status: 200, type: StatusResDto, description: 'Клуб удалён' })
  @ApiResponse({ status: 403, description: 'Недостаточно прав' })
  @ApiResponse({ status: 404, description: 'Клуб не найден' })
  delete(
    @Req() req: Request & { telegramUserId?: string },
    @Param('clubId') clubId: string,
  ): Promise<GeneralApiResponseDto<StatusResDto>> {
    return this.commandBus.execute(
      new DeleteClubCommand(req.telegramUserId, clubId),
    );
  }
}
