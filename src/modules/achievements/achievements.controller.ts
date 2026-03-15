import { Body, Controller, Get, HttpStatus, Post, Req } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { AppRole, Roles } from '@shared/auth';
import { OkStatusResDto } from '@shared/types';

import { SetActiveAchievementCommand } from './commands';
import { SetActiveAchievementReqDto } from './dto/request';
import { AchievementResDto } from './dto/response';
import { GetUserAchievementsQuery } from './queries';

@ApiTags('achievements')
@Roles(AppRole.Member)
@Controller('achievements')
export class AchievementsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get('me')
  @ApiOperation({
    summary: 'Список полученных достижений текущего пользователя',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: [AchievementResDto],
    description: 'Достижения пользователя',
  })
  getMyAchievements(
    @Req() req: Request & { telegramUserId?: string },
  ): Promise<AchievementResDto[]> {
    return this.queryBus.execute(
      new GetUserAchievementsQuery(req.telegramUserId),
    );
  }

  @Post('me/active')
  @ApiOperation({
    summary: 'Применить или снять иконку достижения как аватар',
    description:
      'achievementId — UUID достижения для применения. ' +
      'null — снять активную иконку и вернуть оригинальный аватар.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: OkStatusResDto,
    description: 'Аватар обновлён',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Достижение не найдено или не получено пользователем',
  })
  setActiveAchievement(
    @Req() req: Request & { telegramUserId?: string },
    @Body() dto: SetActiveAchievementReqDto,
  ): Promise<OkStatusResDto> {
    return this.commandBus.execute(
      new SetActiveAchievementCommand(req.telegramUserId, dto.achievementId),
    );
  }
}
