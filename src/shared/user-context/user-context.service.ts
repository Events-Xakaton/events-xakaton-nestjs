import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AppRole } from '../auth/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

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
    await this.ensureRoleExists('Member');
    const memberRole = await this.prisma.role.findUnique({
      where: { code: 'Member' },
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
