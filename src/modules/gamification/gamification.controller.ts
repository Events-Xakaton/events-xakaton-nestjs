import { Controller, Get, Query, Req } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { AppRole, Roles } from '@shared/auth';
import { GeneralApiResponseDto } from '@shared/dto';

import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';
import {
  LeaderboardResDto,
  PointsBalanceResDto,
  PointsHistoryItemResDto,
  PointsRuleResDto,
} from './dto/response';
import {
  GetLeaderboardQuery,
  GetPointsBalanceQuery,
  GetPointsHistoryQuery,
  GetPointsRulesQuery,
} from './queries';

@ApiTags('gamification')
@Controller()
export class GamificationController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('points/rules')
  @ApiOperation({ summary: 'Справочник правил начисления очков' })
  async getRules(): Promise<GeneralApiResponseDto<PointsRuleResDto[]>> {
    return this.queryBus.execute(new GetPointsRulesQuery());
  }

  @Get('points/history')
  @Roles(AppRole.Member)
  @ApiOperation({ summary: 'История начислений очков текущего пользователя' })
  async getHistory(
    @Req() req: Request & { telegramUserId?: string },
  ): Promise<GeneralApiResponseDto<PointsHistoryItemResDto[]>> {
    return this.queryBus.execute(new GetPointsHistoryQuery(req.telegramUserId));
  }

  @Get('points/balance')
  @Roles(AppRole.Member)
  @ApiOperation({ summary: 'Баланс очков: lifetime, weekly, monthly' })
  async getBalance(
    @Req() req: Request & { telegramUserId?: string },
  ): Promise<GeneralApiResponseDto<PointsBalanceResDto>> {
    return this.queryBus.execute(new GetPointsBalanceQuery(req.telegramUserId));
  }

  @Get('leaderboard')
  @Roles(AppRole.Member)
  @ApiOperation({ summary: 'Лидерборд за период (weekly/monthly)' })
  async getLeaderboard(
    @Req() req: Request & { telegramUserId?: string },
    @Query() query: LeaderboardQueryDto,
  ): Promise<GeneralApiResponseDto<LeaderboardResDto>> {
    return this.queryBus.execute(
      new GetLeaderboardQuery(query.period, req.telegramUserId),
    );
  }
}
