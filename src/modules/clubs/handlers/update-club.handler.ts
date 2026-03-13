import { HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AnalyticsService } from '@analytics/analytics.service';
import { AppRole } from '@shared/auth';
import { HttpStatusDescriptions } from '@shared/constants';
import { GeneralApiResponseDto } from '@shared/dto';
import { StatusResDto } from '@shared/types';
import { AppException } from '@shared/exceptions';
import { PrismaService } from '@shared/prisma';
import { UserContextService } from '@shared/user-context';

import { UpdateClubCommand } from '../commands';

@CommandHandler(UpdateClubCommand)
export class UpdateClubHandler implements ICommandHandler<UpdateClubCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async execute(
    command: UpdateClubCommand,
  ): Promise<GeneralApiResponseDto<StatusResDto>> {
    const { telegramUserId, clubId, dto } = command;
    const user =
      await this.userContextService.requireUserByTelegram(telegramUserId);

    const club = await this.prisma.club.findUnique({
      where: { id: clubId },
      select: { id: true, creatorUserId: true, isDeleted: true },
    });
    if (!club || club.isDeleted) {
      throw new AppException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Клуб не найден',
      });
    }

    const canManage = await this.checkCanManage(
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

    if (dto.tags !== undefined && [...new Set(dto.tags)].length > 3) {
      throw new AppException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Слишком много тегов',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      const updateData = {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.categoryCode !== undefined && {
          categoryCode: dto.categoryCode,
        }),
        ...(dto.coverUrl !== undefined && { coverUrl: dto.coverUrl }),
        ...(dto.coverSeed !== undefined && { coverSeed: dto.coverSeed }),
      };

      if (Object.keys(updateData).length > 0) {
        await tx.club.update({ where: { id: clubId }, data: updateData });
      }

      if (dto.tags !== undefined) {
        const tags = [...new Set(dto.tags)];
        await tx.clubTag.deleteMany({ where: { clubId } });
        if (tags.length > 0) {
          await tx.clubTag.createMany({
            data: tags.map((tag) => ({ clubId, tag })),
            skipDuplicates: true,
          });
        }
      }
    });

    void this.analyticsService.track({
      eventName: 'club.update',
      entityType: 'club',
      entityId: clubId,
    });

    return new GeneralApiResponseDto(
      HttpStatus.OK,
      HttpStatusDescriptions[HttpStatus.OK],
      {
        status: 'updated',
      },
    );
  }

  private async checkCanManage(
    userId: string,
    clubId: string,
    creatorUserId: string,
  ): Promise<boolean> {
    if (creatorUserId === userId) return true;

    const [isPlatformAdmin, isClubAdmin] = await Promise.all([
      this.userContextService.hasRole(userId, AppRole.PlatformAdmin),
      this.userContextService.hasRole(userId, AppRole.ClubAdmin),
    ]);
    if (isPlatformAdmin || isClubAdmin) return true;

    const membership = await this.prisma.clubMembership.findUnique({
      where: { clubId_userId: { clubId, userId } },
      select: { role: true },
    });
    return membership?.role === 'owner' || membership?.role === 'admin';
  }
}
