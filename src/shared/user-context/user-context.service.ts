import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AppRole } from '@shared/auth';
import { ClubMembershipRole, ClubMembershipStatus } from '@shared/domain';
import { PrismaService } from '@shared/prisma';

/**
 * Сервис для работы с контекстом пользователя.
 *
 * Обеспечивает:
 * - получение или создание пользователя по Telegram ID
 * - автоматическое присвоение базовой роли Member при первом входе
 * - проверку наличия конкретной роли
 * - назначение ролей администратором
 */
@Injectable()
export class UserContextService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Получает пользователя по telegramUserId.
   * Если пользователя нет — создаёт нового с именем tg-{id}.
   * Автоматически присваивает роль Member при каждом обращении.
   *
   * @throws UnauthorizedException если telegramUserId не передан
   */
  async requireUserByTelegram(
    telegramUserId?: string,
  ): Promise<{ id: string; telegramUserId: bigint }> {
    if (!telegramUserId) {
      throw new UnauthorizedException(
        'Отсутствует контекст пользователя Telegram',
      );
    }

    const user = await this.getOrCreateUserByTelegram(telegramUserId);
    await this.ensureMemberRole(user.id);

    return user;
  }

  /**
   * Проверяет, может ли пользователь управлять клубом (редактировать, удалять).
   * Разрешено: создателю клуба, глобальным администраторам, owner/admin участникам клуба.
   */
  async canManageClub(
    userId: string,
    clubId: string,
    creatorUserId: string,
  ): Promise<boolean> {
    if (creatorUserId === userId) return true;
    if (await this.isGlobalAdmin(userId)) return true;

    const membership = await this.prisma.clubMembership.findUnique({
      where: { clubId_userId: { clubId, userId } },
      select: { role: true },
    });
    return (
      (membership?.role as ClubMembershipRole) === ClubMembershipRole.Owner ||
      (membership?.role as ClubMembershipRole) === ClubMembershipRole.Admin
    );
  }

  /**
   * Проверяет, может ли пользователь управлять событием клуба (изменять, отменять).
   * Разрешено: глобальным администраторам, owner/admin/event_manager участникам клуба.
   * Создатель события проверяется на стороне вызывающего кода до вызова этого метода.
   */
  async canManageClubEvent(
    userId: string,
    clubId: string | null,
  ): Promise<boolean> {
    if (await this.isGlobalAdmin(userId)) return true;
    if (!clubId) return false;

    const membership = await this.prisma.clubMembership.findUnique({
      where: { clubId_userId: { clubId, userId } },
      select: { role: true, status: true },
    });
    const status = membership?.status as ClubMembershipStatus | undefined;
    const role = membership?.role as ClubMembershipRole | undefined;
    return (
      status === ClubMembershipStatus.Joined &&
      (role === ClubMembershipRole.Owner ||
        role === ClubMembershipRole.Admin ||
        role === ClubMembershipRole.EventManager)
    );
  }

  /**
   * Проверяет, может ли пользователь создавать события в клубе.
   * Разрешено: создателю клуба, глобальным администраторам, owner/admin/event_manager участникам.
   */
  async canCreateClubEvent(
    userId: string,
    clubId: string,
    clubCreatorUserId: string,
  ): Promise<boolean> {
    if (clubCreatorUserId === userId) return true;

    // Параллельно проверяем роли и членство для минимизации задержки
    const [isAdmin, membership] = await Promise.all([
      this.isGlobalAdmin(userId),
      this.prisma.clubMembership.findUnique({
        where: { clubId_userId: { clubId, userId } },
        select: { role: true, status: true },
      }),
    ]);
    if (isAdmin) return true;

    const status = membership?.status as ClubMembershipStatus | undefined;
    const role = membership?.role as ClubMembershipRole | undefined;
    return (
      status === ClubMembershipStatus.Joined &&
      (role === ClubMembershipRole.Owner ||
        role === ClubMembershipRole.Admin ||
        role === ClubMembershipRole.EventManager)
    );
  }

  /**
   * Возвращает множество ID пользователей из candidateIds, на которых подписан followerUserId.
   * Используется для вычисления поля followedByMe в списках участников/членов клуба.
   */
  async getFollowedSet(
    followerUserId: string,
    candidateIds: string[],
  ): Promise<Set<string>> {
    if (!candidateIds.length) return new Set();

    const following = await this.prisma.connection.findMany({
      where: { followerUserId, followedUserId: { in: candidateIds } },
      select: { followedUserId: true },
    });
    return new Set(following.map((f) => f.followedUserId));
  }

  /**
   * Проверяет, является ли пользователь глобальным администратором платформы.
   * Возвращает true если у него есть роль PlatformAdmin или ClubAdmin.
   */
  async isGlobalAdmin(userId: string): Promise<boolean> {
    const [isPlatformAdmin, isClubAdmin] = await Promise.all([
      this.hasRole(userId, AppRole.PlatformAdmin),
      this.hasRole(userId, AppRole.ClubAdmin),
    ]);
    return isPlatformAdmin || isClubAdmin;
  }

  /**
   * Проверяет, есть ли у пользователя указанная роль.
   */
  async hasRole(userId: string, role: AppRole): Promise<boolean> {
    const found = await this.prisma.userRole.findFirst({
      where: {
        userId,
        role: { code: role },
      },
      select: { userId: true },
    });
    return Boolean(found);
  }

  /**
   * Назначает роль пользователю по его Telegram ID.
   * Используется из AdminModule.
   */
  async assignRoleByTelegramUserId(
    telegramUserId: string,
    role: AppRole,
  ): Promise<void> {
    const user = await this.getOrCreateUserByTelegram(telegramUserId);
    await this.ensureRoleExists(role);
    const roleRow = await this.prisma.role.findUnique({
      where: { code: role },
      select: { id: true },
    });
    if (!roleRow) {
      return;
    }
    await this.prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: roleRow.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        roleId: roleRow.id,
      },
    });
  }

  /** Обеспечивает наличие записи Role=Member у пользователя */
  private async ensureMemberRole(userId: string): Promise<void> {
    await this.ensureRoleExists(AppRole.Member);
    const memberRole = await this.prisma.role.findUnique({
      where: { code: AppRole.Member },
      select: { id: true },
    });
    if (!memberRole) {
      return;
    }

    await this.prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId,
          roleId: memberRole.id,
        },
      },
      update: {},
      create: {
        userId,
        roleId: memberRole.id,
      },
    });
  }

  /** Создаёт запись роли в БД если её ещё нет (idempotent) */
  private async ensureRoleExists(role: AppRole): Promise<void> {
    await this.prisma.role.upsert({
      where: { code: role },
      update: {},
      create: { code: role },
    });
  }

  /**
   * Получает пользователя по Telegram ID или создаёт нового.
   * Обрабатывает race condition при одновременном создании (P2002 unique constraint).
   */
  private async getOrCreateUserByTelegram(telegramUserId: string): Promise<{
    id: string;
    telegramUserId: bigint;
  }> {
    const tgId = BigInt(telegramUserId);
    const existing = await this.prisma.user.findUnique({
      where: { telegramUserId: tgId },
      select: { id: true, telegramUserId: true },
    });
    if (existing) {
      return existing;
    }

    try {
      return await this.prisma.user.create({
        data: {
          telegramUserId: tgId,
          fullName: `tg-${telegramUserId}`,
        },
        select: { id: true, telegramUserId: true },
      });
    } catch (error) {
      // Если два запроса одновременно пытаются создать одного пользователя,
      // второй получит P2002. В этом случае возвращаем уже созданную запись.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raced = await this.prisma.user.findUnique({
          where: { telegramUserId: tgId },
          select: { id: true, telegramUserId: true },
        });
        if (raced) {
          return raced;
        }
      }
      throw error;
    }
  }
}
