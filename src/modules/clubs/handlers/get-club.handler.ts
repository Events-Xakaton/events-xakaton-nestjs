import { HttpStatus } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { ClubMembershipRole, ClubMembershipStatus } from '@shared/domain';
import { AppException } from '@shared/exceptions';
import { PrismaService } from '@shared/prisma';
import { UserContextService } from '@shared/user-context';

import { ClubDetailResDto } from '../dto/response';
import { GetClubQuery } from '../queries';

@QueryHandler(GetClubQuery)
export class GetClubHandler implements IQueryHandler<GetClubQuery> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
  ) {}

  async execute(query: GetClubQuery): Promise<ClubDetailResDto> {
    const { telegramUserId, clubId } = query;
    const user =
      await this.userContextService.requireUserByTelegram(telegramUserId);

    const club = await this.prisma.club.findFirst({
      where: { id: clubId, isDeleted: false },
      include: {
        creator: { select: { telegramUserId: true, fullName: true } },
        tags: { select: { tag: true } },
        memberships: {
          where: { status: ClubMembershipStatus.Joined },
          select: { userId: true },
        },
      },
    });
    if (!club) {
      throw new AppException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Клуб не найден',
      });
    }

    const myMembership = await this.prisma.clubMembership.findUnique({
      where: { clubId_userId: { clubId, userId: user.id } },
      select: { status: true, role: true },
    });

    const joinedByMe = myMembership?.status === ClubMembershipStatus.Joined;
    const canManage = await this.checkCanManage(
      user.id,
      club.creatorUserId,
      myMembership?.role,
    );

    return new ClubDetailResDto({
      id: club.id,
      title: club.title,
      description: club.description,
      categoryCode: club.categoryCode,
      coverUrl: club.coverUrl ?? null,
      creatorTelegramUserId: club.creator.telegramUserId.toString(),
      creatorName: club.creator.fullName,
      membersCount: club.memberships.length,
      joinedByMe,
      canManage,
      tags: club.tags.map((t) => t.tag),
      coverSeed: club.coverSeed ?? null,
    });
  }

  private async checkCanManage(
    userId: string,
    creatorUserId: string,
    membershipRole?: string,
  ): Promise<boolean> {
    if (creatorUserId === userId) return true;
    if (await this.userContextService.isGlobalAdmin(userId)) return true;

    return (
      membershipRole === ClubMembershipRole.Owner ||
      membershipRole === ClubMembershipRole.Admin
    );
  }
}
