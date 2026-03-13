import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PrismaService } from '@shared/prisma';

import { AppRole, ROLES_KEY } from './roles.decorator';

/**
 * Guard для проверки RBAC-прав.
 *
 * Если на маршруте нет декоратора @Roles — доступ открыт всем.
 * Если указана роль Member — доступ для любого аутентифицированного пользователя.
 * Для остальных ролей (ClubAdmin, PlatformAdmin) — делаем запрос в БД.
 */
@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles =
      this.reflector.getAllAndOverride<AppRole[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    // Маршрут без @Roles — публичный
    if (requiredRoles.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<{
      telegramUserId?: string;
      headers?: Record<string, string>;
    }>();
    const telegramUserId =
      req.telegramUserId ?? req.headers?.['x-telegram-user-id'];
    if (!telegramUserId) {
      throw new UnauthorizedException(
        'Отсутствует контекст пользователя Telegram',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { telegramUserId: BigInt(telegramUserId) },
      select: { id: true },
    });
    if (!user) {
      // Роль Member — базовая для любого существующего пользователя; новый пользователь
      // создаётся через UserContextService при первом запросе к защищённому эндпоинту
      if (requiredRoles.every((role) => role === AppRole.Member)) {
        return true;
      }
      throw new ForbiddenException('Пользователь не найден');
    }

    const roles = await this.prisma.userRole.findMany({
      where: { userId: user.id },
      include: {
        role: {
          select: { code: true },
        },
      },
    });
    const userRoles = new Set(roles.map((r) => r.role.code as AppRole));

    const hasRole = requiredRoles.some((role) => {
      // Member — базовая роль; любой существующий пользователь считается Member
      if (role === AppRole.Member) {
        return true;
      }
      return userRoles.has(role);
    });
    if (!hasRole) {
      throw new ForbiddenException('Недостаточно прав');
    }

    return true;
  }
}
