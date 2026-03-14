import { HttpStatus } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { PAGINATION } from '@shared/constants';
import { ClubMembershipStatus } from '@shared/domain';
import { PrismaService } from '@shared/prisma';
import { UserContextService } from '@shared/user-context';

import { ClubListItemResDto } from '../dto/response';
import { ListClubsQuery } from '../queries';

@QueryHandler(ListClubsQuery)
export class ListClubsHandler implements IQueryHandler<ListClubsQuery> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
  ) {}

  async execute(
    query: ListClubsQuery,
  ): Promise<ClubListItemResDto[]> {
    const { telegramUserId } = query;
    const user =
      await this.userContextService.requireUserByTelegram(telegramUserId);

    const clubs = await this.prisma.club.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: 'desc' },
      include: {
        memberships: {
          where: { status: ClubMembershipStatus.Joined },
          select: { userId: true },
        },
      },
      take: PAGINATION.CLUBS_LIST_LIMIT,
    });

    const items = clubs.map(
      (club) =>
        new ClubListItemResDto({
          id: club.id,
          title: club.title,
          description: club.description,
          categoryCode: club.categoryCode,
          membersCount: club.memberships.length,
          coverSeed: club.coverSeed ?? null,
          joinedByMe: club.memberships.some((m) => m.userId === user.id),
          isCreator: club.creatorUserId === user.id,
        }),
    );

    return items;
  }
}
