import { HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AnalyticsService } from '@analytics/analytics.service';
import { PointsService } from '@points/points.service';
import { HttpStatusDescriptions } from '@shared/constants';
import { ClubMembershipStatus, EventStatus } from '@shared/domain';
import { GeneralApiResponseDto } from '@shared/dto';
import { AppException } from '@shared/exceptions';
import { PrismaService } from '@shared/prisma';
import { StatusResDto } from '@shared/types';
import { UserContextService } from '@shared/user-context';

import { DeleteClubCommand } from '../commands';

@CommandHandler(DeleteClubCommand)
export class DeleteClubHandler implements ICommandHandler<DeleteClubCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
    private readonly pointsService: PointsService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async execute(
    command: DeleteClubCommand,
  ): Promise<GeneralApiResponseDto<StatusResDto>> {
    const { telegramUserId, clubId } = command;
    const user =
      await this.userContextService.requireUserByTelegram(telegramUserId);

    const club = await this.prisma.club.findUnique({
      where: { id: clubId },
      select: { id: true, creatorUserId: true, isDeleted: true },
    });
    if (!club) {
      throw new AppException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Клуб не найден',
      });
    }

    // Идемпотентность: уже удалённый клуб
    if (club.isDeleted) {
      return new GeneralApiResponseDto(
        HttpStatus.OK,
        HttpStatusDescriptions[HttpStatus.OK],
        {
          status: 'deleted',
        },
      );
    }

    const canManage = await this.userContextService.canManageClub(
      user.id,
      clubId,
      club.creatorUserId,
    );
    if (!canManage) {
      throw new AppException({
        statusCode: HttpStatus.FORBIDDEN,
        message: 'Недостаточно прав для управления клубом',
      });
    }

    // Считаем активность клуба — нужно для решения об откате очков
    const [joinedMembersExceptOwnerCount, activeEventsCount] =
      await Promise.all([
        this.prisma.clubMembership.count({
          where: {
            clubId,
            status: ClubMembershipStatus.Joined,
            userId: { not: club.creatorUserId },
          },
        }),
        this.prisma.event.count({ where: { clubId, isDeleted: false } }),
      ]);

    await this.prisma.$transaction(async (tx) => {
      await tx.club.update({
        where: { id: clubId },
        data: { isDeleted: true, deletedAt: new Date() },
      });

      // Все активные события клуба отменяются вместе с ним
      await tx.event.updateMany({
        where: { clubId, isDeleted: false },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          status: EventStatus.Cancelled,
        },
      });
    });

    // Откатываем очки только если клуб был пустым (не было реальной активности)
    if (joinedMembersExceptOwnerCount === 0 && activeEventsCount === 0) {
      await this.pointsService.rollbackByReference(
        club.creatorUserId,
        `club_create_${clubId}`,
        'club_create_rollback',
      );
    }

    void this.analyticsService.track({
      eventName: 'club.delete',
      entityType: 'club',
      entityId: clubId,
    });

    return new GeneralApiResponseDto(
      HttpStatus.OK,
      HttpStatusDescriptions[HttpStatus.OK],
      {
        status: 'deleted',
      },
    );
  }
}
