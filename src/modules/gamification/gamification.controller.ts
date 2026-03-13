import { Controller, Get, Query, Req } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { Roles } from '../../shared/auth/roles.decorator';
import { GeneralApiResponseDto } from '../../shared/dto';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';
import {
  GetLeaderboardQuery,
  GetPointsBalanceQuery,
  GetPointsHistoryQuery,
  GetPointsRulesQuery,
} from './queries';

type LeaderboardEntry = {
  rank: number;
  userId: string;
  fullName: string;
  points: number;
};

@ApiTags('gamification')
@Controller()
export class GamificationController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('points/rules')
  @ApiOperation({ summary: 'Справочник правил начисления очков' })
  async getRules(): Promise<
    GeneralApiResponseDto<Array<{ rule: string; points: number }>>
  > {
    return this.queryBus.execute(new GetPointsRulesQuery());
  }

  @Get('points/history')
  @Roles('Member')
  @ApiOperation({ summary: 'История начислений очков текущего пользователя' })
  async getHistory(@Req() req: Request & { telegramUserId?: string }): Promise<
    GeneralApiResponseDto<
      Array<{
        id: string;
        ruleCode: string;
        deltaPoints: number;
        createdAt: Date;
      }>
    >
  > {
    return this.queryBus.execute(new GetPointsHistoryQuery(req.telegramUserId));
  }

  @Get('points/balance')
  @Roles('Member')
  @ApiOperation({ summary: 'Баланс очков: lifetime, weekly, monthly' })
  async getBalance(
    @Req() req: Request & { telegramUserId?: string },
  ): Promise<
    GeneralApiResponseDto<{ lifetime: number; weekly: number; monthly: number }>
  > {
    return this.queryBus.execute(new GetPointsBalanceQuery(req.telegramUserId));
  }

  @Get('leaderboard')
  @Roles('Member')
  @ApiOperation({ summary: 'Лидерборд за период (weekly/monthly)' })
  async getLeaderboard(
    @Req() req: Request & { telegramUserId?: string },
    @Query() query: LeaderboardQueryDto,
  ): Promise<
    GeneralApiResponseDto<{
      period: 'weekly' | 'monthly';
      top: LeaderboardEntry[];
      currentUser: LeaderboardEntry | null;
    }>
  > {
    return this.queryBus.execute(
      new GetLeaderboardQuery(query.period, req.telegramUserId),
    );
  }
}
