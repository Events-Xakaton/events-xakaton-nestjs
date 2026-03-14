import { HttpStatus } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { PAGINATION } from '@shared/constants';
import { ClubMembershipRole, ClubMembershipStatus } from '@shared/domain';
import { PrismaService } from '@shared/prisma';
import { UserContextService } from '@shared/user-context';

import { ClubAuthoringItemResDto } from '../dto/response';
import { ListEventAuthoringClubsQuery } from '../queries';

@QueryHandler(ListEventAuthoringClubsQuery)
export class ListEventAuthoringClubsHandler implements IQueryHandler<ListEventAuthoringClubsQuery> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
  ) {}

  async execute(
    query: ListEventAuthoringClubsQuery,
  ): Promise<ClubAuthoringItemResDto[]> {
    const { telegramUserId } = query;
    const user =
      await this.userContextService.requireUserByTelegram(telegramUserId);

    // Администраторы платформы видят все клубы
    if (await this.userContextService.isGlobalAdmin(user.id)) {
      const clubs = await this.prisma.club.findMany({
        where: { isDeleted: false },
        select: { id: true, title: true, creatorUserId: true },
        orderBy: { title: 'asc' },
        take: PAGINATION.CLUB_AUTHORING_LIMIT,
      });

      const items = clubs.map(
        (club) =>
          new ClubAuthoringItemResDto({
            id: club.id,
            title: club.title,
            role:
              club.creatorUserId === user.id
                ? ClubMembershipRole.Owner
                : ClubMembershipRole.Admin,
          }),
      );

      return items;
    }

    // Обычный пользователь видит только клубы, где он owner/admin/event_manager
    const memberships = await this.prisma.clubMembership.findMany({
      where: {
        userId: user.id,
        status: ClubMembershipStatus.Joined,
        role: {
          in: [
            ClubMembershipRole.Owner,
            ClubMembershipRole.Admin,
            ClubMembershipRole.EventManager,
          ],
        },
        club: { isDeleted: false },
      },
      include: {
        club: { select: { id: true, title: true } },
      },
      orderBy: { club: { title: 'asc' } },
      take: PAGINATION.CLUB_AUTHORING_LIMIT,
    });

    const items = memberships.map(
      (m) =>
        new ClubAuthoringItemResDto({
          id: m.club.id,
          title: m.club.title,
          role: m.role,
        }),
    );

    return items;
  }
}
