import { HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AnalyticsService } from '@analytics/analytics.service';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { PointsService } from '@points/points.service';
import { HttpStatusDescriptions } from '@shared/constants';
import { GeneralApiResponseDto } from '@shared/dto';
import { AppException } from '@shared/exceptions';
import { PrismaService } from '@shared/prisma';
import { StatusResDto } from '@shared/types';
import { UserContextService } from '@shared/user-context';

import { JoinClubCommand } from '../commands';

@CommandHandler(JoinClubCommand)
export class JoinClubHandler implements ICommandHandler<JoinClubCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
    private readonly pointsService: PointsService,
    private readonly notificationsService: NotificationsService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async execute(
    command: JoinClubCommand,
  ): Promise<GeneralApiResponseDto<StatusResDto>> {
    const { telegramUserId, clubId } = command;
    const user =
      await this.userContextService.requireUserByTelegram(telegramUserId);

    const club = await this.prisma.club.findFirst({
      where: { id: clubId, isDeleted: false },
      select: { id: true, title: true, creatorUserId: true },
    });
    if (!club) {
      throw new AppException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Клуб не найден',
      });
    }

    const existing = await this.prisma.clubMembership.findUnique({
      where: { clubId_userId: { clubId, userId: user.id } },
      select: { role: true },
    });

    await this.prisma.clubMembership.upsert({
      where: { clubId_userId: { clubId, userId: user.id } },
      update: { status: 'joined', role: existing?.role ?? 'member' },
      create: { clubId, userId: user.id, status: 'joined', role: 'member' },
    });

    await this.pointsService.award({
      userId: user.id,
      ruleCode: 'club_join',
      deltaPoints: 3,
      referenceId: `club_join_${clubId}_${user.id}`,
      clubId,
    });

    if (club.creatorUserId !== user.id) {
      const actor = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { fullName: true },
      });

      await this.pointsService.award({
        userId: club.creatorUserId,
        ruleCode: 'club_new_member_bonus',
        deltaPoints: 1,
        referenceId: `club_new_member_${clubId}_${user.id}`,
        clubId,
      });

      void this.notificationsService.createInAppNotification({
        userId: club.creatorUserId,
        type: 'new_follower',
        title: 'Новый участник',
        body: `Новый участник: **${actor?.fullName ?? 'Пользователь'}** в клубе **${club.title}**`,
        targetType: 'club',
        targetId: clubId,
      });
    }

    void this.analyticsService.track({
      eventName: 'club.join',
      entityType: 'club',
      entityId: clubId,
    });

    return new GeneralApiResponseDto(
      HttpStatus.OK,
      HttpStatusDescriptions[HttpStatus.OK],
      {
        status: 'joined',
      },
    );
  }
}
