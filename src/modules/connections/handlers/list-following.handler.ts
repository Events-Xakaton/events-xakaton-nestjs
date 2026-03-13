import { HttpStatus } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { HttpStatusDescriptions } from '../../../shared/constants';
import { GeneralApiResponseDto } from '../../../shared/dto';
import { PrismaService } from '../../../shared/prisma';
import { UserContextService } from '../../../shared/user-context';
import { FollowingItemResDto } from '../dto/response';
import { ListFollowingQuery } from '../queries';

@QueryHandler(ListFollowingQuery)
export class ListFollowingHandler implements IQueryHandler<ListFollowingQuery> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
  ) {}

  async execute(
    query: ListFollowingQuery,
  ): Promise<GeneralApiResponseDto<FollowingItemResDto[]>> {
    const user = await this.userContextService.requireUserByTelegram(
      query.telegramUserId,
    );

    const rows = await this.prisma.connection.findMany({
      where: { followerUserId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        followed: { select: { telegramUserId: true, fullName: true } },
      },
      take: 200,
    });

    const items = rows.map(
      (r) =>
        new FollowingItemResDto({
          telegramUserId: r.followed.telegramUserId.toString(),
          fullName: r.followed.fullName,
          followedAt: r.createdAt,
        }),
    );

    return new GeneralApiResponseDto(
      HttpStatus.OK,
      HttpStatusDescriptions[HttpStatus.OK],
      items,
    );
  }
}
