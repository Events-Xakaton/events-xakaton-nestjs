import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AppRole, Roles } from '@shared/auth';
import { GeneralApiResponseDto } from '@shared/dto';
import { OkStatusResDto } from '@shared/types';

import { AssignRoleCommand } from './commands';
import { AssignRoleDto } from './dto/assign-role.dto';
import { ReportRangeDto } from './dto/report-range.dto';
import { AdminUserResDto, OverviewReportResDto } from './dto/response';
import { GetAdminUserQuery, GetOverviewReportQuery } from './queries';

@ApiTags('admin')
@Roles(AppRole.PlatformAdmin)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Post('users/:telegramUserId/roles')
  @ApiOperation({ summary: 'Назначить роль пользователю' })
  @ApiResponse({ status: 403, description: 'Только PlatformAdmin' })
  async assignRole(
    @Param('telegramUserId') telegramUserId: string,
    @Body() dto: AssignRoleDto,
  ): Promise<GeneralApiResponseDto<OkStatusResDto>> {
    return this.commandBus.execute(
      new AssignRoleCommand(telegramUserId, dto.role),
    );
  }

  @Get('users/:telegramUserId')
  @ApiOperation({ summary: 'Профиль пользователя с ролями' })
  @ApiResponse({ status: 404, description: 'Пользователь не найден' })
  async getUser(
    @Param('telegramUserId') telegramUserId: string,
  ): Promise<GeneralApiResponseDto<AdminUserResDto>> {
    return this.queryBus.execute(new GetAdminUserQuery(telegramUserId));
  }

  @Get('reports/overview')
  @ApiOperation({ summary: 'Сводный отчёт по платформе' })
  async getOverviewReport(
    @Query() range: ReportRangeDto,
  ): Promise<GeneralApiResponseDto<OverviewReportResDto>> {
    return this.queryBus.execute(new GetOverviewReportQuery(range));
  }
}
