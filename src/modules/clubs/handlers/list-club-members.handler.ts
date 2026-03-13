import { HttpStatus } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { HttpStatusDescriptions, PAGINATION } from '@shared/constants';
import { ClubMembershipStatus } from '@shared/domain';
import { GeneralApiResponseDto } from '@shared/dto';
import { AppException } from '@shared/exceptions';
import { PrismaService } from '@shared/prisma';
import { UserContextService } from '@shared/user-context';

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
      throw new AppException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Клуб не найден',
      });
    }

    const members = await this.prisma.clubMembership.findMany({
      where: { clubId, status: ClubMembershipStatus.Joined },
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
      take: PAGINATION.CLUB_MEMBERS_LIMIT,
    });

    const memberIds = members.map((m) => m.user.id);
    const followedSet = await this.userContextService.getFollowedSet(
      user.id,
      memberIds,
    );

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
