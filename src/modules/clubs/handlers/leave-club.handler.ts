import { HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AnalyticsService } from '@analytics/analytics.service';
import { PointsService } from '@points/points.service';
import { HttpStatusDescriptions } from '@shared/constants';
import { GeneralApiResponseDto } from '@shared/dto';
import { StatusResDto } from '@shared/types';
import { AppException } from '@shared/exceptions';
import { PrismaService } from '@shared/prisma';
import { UserContextService } from '@shared/user-context';

import { LeaveClubCommand } from '../commands';

@CommandHandler(LeaveClubCommand)
export class LeaveClubHandler implements ICommandHandler<LeaveClubCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
    private readonly pointsService: PointsService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async execute(
    command: LeaveClubCommand,
  ): Promise<GeneralApiResponseDto<StatusResDto>> {
    const { telegramUserId, clubId } = command;
    const user =
      await this.userContextService.requireUserByTelegram(telegramUserId);

    const membership = await this.prisma.clubMembership.findUnique({
      where: { clubId_userId: { clubId, userId: user.id } },
    });
    if (!membership) {
      throw new AppException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Членство в клубе не найдено',
      });
    }

    // Владелец не может покинуть собственный клуб — нужно сначала передать права
    if (membership.role === 'owner') {
      throw new AppException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Владелец клуба не может покинуть свой клуб',
      });
    }

    await this.prisma.clubMembership.update({
      where: { clubId_userId: { clubId, userId: user.id } },
      data: { status: 'left' },
    });

    await this.pointsService.rollbackByReference(
      user.id,
      `club_join_${clubId}_${user.id}`,
      'club_join_rollback',
    );

    void this.analyticsService.track({
      eventName: 'club.leave',
      entityType: 'club',
      entityId: clubId,
    });

    return new GeneralApiResponseDto(
      HttpStatus.OK,
      HttpStatusDescriptions[HttpStatus.OK],
      {
        status: 'left',
      },
    );
  }
}
