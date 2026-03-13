import { HttpStatus } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { HttpStatusDescriptions } from '../../../shared/constants';
import { GeneralApiResponseDto } from '../../../shared/dto';
import { PrismaService } from '../../../shared/prisma';
import { UserContextService } from '../../../shared/user-context';
import { ClubMemberResDto } from '../dto/response';
import { ListClubMembersQuery } from '../queries';

@QueryHandler(ListClubMembersQuery)
export class ListClubMembersHandler implements IQueryHandler<ListClubMembersQuery> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
  ) {}

  async execute(
    query: ListClubMembersQuery,
  ): Promise<GeneralApiResponseDto<ClubMemberResDto[]>> {
    const { telegramUserId, clubId } = query;
    const user =
      await this.userContextService.requireUserByTelegram(telegramUserId);

    const club = await this.prisma.club.findFirst({
      where: { id: clubId, isDeleted: false },
      select: { id: true },
    });
    if (!club) {
      return new GeneralApiResponseDto(
        HttpStatus.NOT_FOUND,
        HttpStatusDescriptions[HttpStatus.NOT_FOUND],
        null as never,
        { message: 'Клуб не найден' },
      );
    }

    const members = await this.prisma.clubMembership.findMany({
      where: { clubId, status: 'joined' },
      include: {
        user: {
          select: {
            id: true,
            telegramUserId: true,
            fullName: true,
            avatarUrl: true,
          },
        },
      },
      // owner/admin первые, затем по дате вступления
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
      take: 300,
    });

    const memberIds = members.map((m) => m.user.id);
    const following = memberIds.length
      ? await this.prisma.connection.findMany({
          where: { followerUserId: user.id, followedUserId: { in: memberIds } },
          select: { followedUserId: true },
        })
      : [];
    const followedSet = new Set(following.map((f) => f.followedUserId));

    const items = members.map(
      (m) =>
        new ClubMemberResDto({
          telegramUserId: m.user.telegramUserId.toString(),
          fullName: m.user.fullName,
          avatarUrl: m.user.avatarUrl ?? null,
          followedByMe: followedSet.has(m.user.id),
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
