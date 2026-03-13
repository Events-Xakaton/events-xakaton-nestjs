import { SetMetadata } from '@nestjs/common';

/** Роль пользователя в системе */
export enum AppRole {
  Member = 'Member',
  ClubAdmin = 'ClubAdmin',
  PlatformAdmin = 'PlatformAdmin',
}

export const ROLES_KEY = 'roles';

/**
 * Декоратор для указания требуемых ролей на маршруте или контроллере.
 *
 * @example
 * \@Roles(AppRole.PlatformAdmin)
 * \@Get("admin/users")
 */
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
