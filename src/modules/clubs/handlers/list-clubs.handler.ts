import { HttpStatus } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { HttpStatusDescriptions } from '../../../shared/constants';
import { GeneralApiResponseDto } from '../../../shared/dto';
import { PrismaService } from '../../../shared/prisma';
import { UserContextService } from '../../../shared/user-context';
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
  ): Promise<GeneralApiResponseDto<ClubListItemResDto[]>> {
    const { telegramUserId } = query;
    const user =
      await this.userContextService.requireUserByTelegram(telegramUserId);

    const clubs = await this.prisma.club.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: 'desc' },
      include: {
        memberships: {
          where: { status: 'joined' },
          select: { userId: true },
        },
      },
      take: 50,
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

    return new GeneralApiResponseDto(
      HttpStatus.OK,
      HttpStatusDescriptions[HttpStatus.OK],
      items,
    );
  }
}
