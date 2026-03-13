import { SetMetadata } from '@nestjs/common';

/** Тип роли пользователя в системе */
export type AppRole = 'Member' | 'ClubAdmin' | 'PlatformAdmin';

export const ROLES_KEY = 'roles';

/**
 * Декоратор для указания требуемых ролей на маршруте или контроллере.
 *
 * @example
 * \@Roles("PlatformAdmin")
 * \@Get("admin/users")
 */
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
