import { HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AnalyticsService } from '../../../analytics/analytics.service';
import { PointsService } from '../../../points/points.service';
import { HttpStatusDescriptions } from '../../../shared/constants';
import { GeneralApiResponseDto } from '../../../shared/dto';
import { PrismaService } from '../../../shared/prisma';
import { UserContextService } from '../../../shared/user-context';
import { CreateClubCommand } from '../commands';

@CommandHandler(CreateClubCommand)
export class CreateClubHandler implements ICommandHandler<CreateClubCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
    private readonly pointsService: PointsService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async execute(
    command: CreateClubCommand,
  ): Promise<GeneralApiResponseDto<{ id: string }>> {
    const { telegramUserId, dto } = command;
    const user =
      await this.userContextService.requireUserByTelegram(telegramUserId);

    const tags = [...new Set(dto.tags ?? [])];
    if (tags.length > 3) {
      return new GeneralApiResponseDto(
        HttpStatus.BAD_REQUEST,
        HttpStatusDescriptions[HttpStatus.BAD_REQUEST],
        null as never,
        { message: 'Слишком много тегов' },
      );
    }

    const club = await this.prisma.club.create({
      data: {
        creatorUserId: user.id,
        title: dto.title,
        description: dto.description,
        categoryCode: dto.categoryCode,
        coverUrl: dto.coverUrl,
        coverSeed: dto.coverSeed,
        tags: { create: tags.map((tag) => ({ tag })) },
        // Создатель автоматически становится владельцем
        memberships: {
          create: { userId: user.id, status: 'joined', role: 'owner' },
        },
      },
      select: { id: true },
    });

    await this.pointsService.award({
      userId: user.id,
      ruleCode: 'club_create',
      deltaPoints: 10,
      referenceId: `club_create_${club.id}`,
      clubId: club.id,
    });

    void this.analyticsService.track({
      eventName: 'club.create',
      entityType: 'club',
      entityId: club.id,
    });

    return new GeneralApiResponseDto(
      HttpStatus.CREATED,
      HttpStatusDescriptions[HttpStatus.CREATED],
      { id: club.id },
    );
  }
}
