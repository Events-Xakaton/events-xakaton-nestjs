import { HttpStatus } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { HttpStatusDescriptions } from '@shared/constants';
import { GeneralApiResponseDto } from '@shared/dto';
import { PrismaService } from '@shared/prisma';
import { UserContextService } from '@shared/user-context';

import { PointsHistoryItemResDto } from '../dto/response';
import { GetPointsHistoryQuery } from '../queries';

@QueryHandler(GetPointsHistoryQuery)
export class GetPointsHistoryHandler implements IQueryHandler<GetPointsHistoryQuery> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
  ) {}

  async execute(
    query: GetPointsHistoryQuery,
  ): Promise<GeneralApiResponseDto<PointsHistoryItemResDto[]>> {
    const user = await this.userContextService.requireUserByTelegram(
      query.telegramUserId,
    );

    const history = await this.prisma.pointsLedger.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, ruleCode: true, deltaPoints: true, createdAt: true },
    });

    return new GeneralApiResponseDto(
      HttpStatus.OK,
      HttpStatusDescriptions[HttpStatus.OK],
      history,
    );
  }
}
