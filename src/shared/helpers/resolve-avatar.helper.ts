/**
 * Возвращает итоговый URL аватара пользователя.
 * Если у пользователя есть активное достижение с иконкой — возвращает её.
 * Иначе — оригинальный Telegram-аватар.
 */
export function resolveAvatarUrl(
  user: {
    avatarUrl: string | null;
    activeAchievement?: { iconPath: string } | null;
  },
  staticBaseUrl: string,
): string | null {
  if (user.activeAchievement?.iconPath) {
    return `${staticBaseUrl}/api/static/${user.activeAchievement.iconPath}`;
  }
  return user.avatarUrl ?? null;
}
