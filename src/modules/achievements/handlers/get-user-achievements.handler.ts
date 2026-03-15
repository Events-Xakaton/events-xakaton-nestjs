import { ConfigService } from '@nestjs/config';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { EnvVariableName } from '@shared/config';
import { PrismaService } from '@shared/prisma';
import { UserContextService } from '@shared/user-context';

import { AchievementResDto } from '../dto/response';
import { GetUserAchievementsQuery } from '../queries';

@QueryHandler(GetUserAchievementsQuery)
export class GetUserAchievementsHandler implements IQueryHandler<GetUserAchievementsQuery> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
    private readonly config: ConfigService,
  ) {}

  async execute(query: GetUserAchievementsQuery): Promise<AchievementResDto[]> {
    const user = await this.userContextService.requireUserByTelegram(
      query.telegramUserId,
    );

    const [userRecord, userAchievements] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: user.id },
        select: { activeAchievementId: true },
      }),
      this.prisma.userAchievement.findMany({
        where: { userId: user.id },
        include: { achievement: true },
        orderBy: { earnedAt: 'asc' },
      }),
    ]);

    const activeAchievementId = userRecord?.activeAchievementId ?? null;
    const baseUrl =
      this.config.get<string>(EnvVariableName.MINI_APP_URL) ??
      'http://localhost:4000';

    return userAchievements.map((ua) => ({
      id: ua.achievement.id,
      code: ua.achievement.code,
      name: ua.achievement.name,
      description: ua.achievement.description,
      iconUrl: `${baseUrl}/api/static/${ua.achievement.iconPath}`,
      earnedAt: ua.earnedAt.toISOString(),
      isActive: activeAchievementId === ua.achievementId,
    }));
  }
}
