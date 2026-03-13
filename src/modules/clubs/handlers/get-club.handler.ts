import { HttpStatus } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { AppRole } from '@shared/auth';
import { HttpStatusDescriptions } from '@shared/constants';
import { GeneralApiResponseDto } from '@shared/dto';
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

  async execute(
    query: GetClubQuery,
  ): Promise<GeneralApiResponseDto<ClubDetailResDto>> {
    const { telegramUserId, clubId } = query;
    const user =
      await this.userContextService.requireUserByTelegram(telegramUserId);

    const club = await this.prisma.club.findFirst({
      where: { id: clubId, isDeleted: false },
      include: {
        creator: { select: { telegramUserId: true, fullName: true } },
        tags: { select: { tag: true } },
        memberships: {
          where: { status: 'joined' },
          select: { userId: true },
        },
      },
    });
    if (!club) {
      return new GeneralApiResponseDto(
        HttpStatus.NOT_FOUND,
        HttpStatusDescriptions[HttpStatus.NOT_FOUND],
        null as never,
        { message: 'Клуб не найден' },
      );
    }

    const myMembership = await this.prisma.clubMembership.findUnique({
      where: { clubId_userId: { clubId, userId: user.id } },
      select: { status: true, role: true },
    });

    const joinedByMe = myMembership?.status === 'joined';
    const canManage = await this.checkCanManage(
      user.id,
      club.creatorUserId,
      myMembership?.role,
    );

    return new GeneralApiResponseDto(
      HttpStatus.OK,
      HttpStatusDescriptions[HttpStatus.OK],
      new ClubDetailResDto({
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
      }),
    );
  }

  private async checkCanManage(
    userId: string,
    creatorUserId: string,
    membershipRole?: string,
  ): Promise<boolean> {
    if (creatorUserId === userId) return true;

    const [isPlatformAdmin, isClubAdmin] = await Promise.all([
      this.userContextService.hasRole(userId, AppRole.PlatformAdmin),
      this.userContextService.hasRole(userId, AppRole.ClubAdmin),
    ]);
    if (isPlatformAdmin || isClubAdmin) return true;

    return membershipRole === 'owner' || membershipRole === 'admin';
  }
}
