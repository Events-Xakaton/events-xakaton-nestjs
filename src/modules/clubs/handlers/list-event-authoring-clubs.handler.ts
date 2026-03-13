import { HttpStatus } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { HttpStatusDescriptions } from '../../../shared/constants';
import { GeneralApiResponseDto } from '../../../shared/dto';
import { PrismaService } from '../../../shared/prisma';
import { UserContextService } from '../../../shared/user-context';
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
  ): Promise<GeneralApiResponseDto<ClubAuthoringItemResDto[]>> {
    const { telegramUserId } = query;
    const user =
      await this.userContextService.requireUserByTelegram(telegramUserId);

    const [isPlatformAdmin, isClubAdmin] = await Promise.all([
      this.userContextService.hasRole(user.id, 'PlatformAdmin'),
      this.userContextService.hasRole(user.id, 'ClubAdmin'),
    ]);

    // Администраторы платформы видят все клубы
    if (isPlatformAdmin || isClubAdmin) {
      const clubs = await this.prisma.club.findMany({
        where: { isDeleted: false },
        select: { id: true, title: true, creatorUserId: true },
        orderBy: { title: 'asc' },
        take: 200,
      });

      const items = clubs.map(
        (club) =>
          new ClubAuthoringItemResDto({
            id: club.id,
            title: club.title,
            role: club.creatorUserId === user.id ? 'owner' : 'admin',
          }),
      );

      return new GeneralApiResponseDto(
        HttpStatus.OK,
        HttpStatusDescriptions[HttpStatus.OK],
        items,
      );
    }

    // Обычный пользователь видит только клубы, где он owner/admin/event_manager
    const memberships = await this.prisma.clubMembership.findMany({
      where: {
        userId: user.id,
        status: 'joined',
        role: { in: ['owner', 'admin', 'event_manager'] },
        club: { isDeleted: false },
      },
      include: {
        club: { select: { id: true, title: true } },
      },
      orderBy: { club: { title: 'asc' } },
      take: 200,
    });

    const items = memberships.map(
      (m) =>
        new ClubAuthoringItemResDto({
          id: m.club.id,
          title: m.club.title,
          role: m.role,
        }),
    );

    return new GeneralApiResponseDto(
      HttpStatus.OK,
      HttpStatusDescriptions[HttpStatus.OK],
      items,
    );
  }
}
