/**
 * Вычисляет эффективный статус события на основе текущего времени.
 *
 * Вынесено в shared чтобы избежать дублирования в clubs и events модулях
 * и исключить циклические зависимости между ними.
 */
export function computeEventStatus(
  status: string,
  startsAtUtc: Date,
  endsAtUtc: Date,
  now: Date,
): 'upcoming' | 'ongoing' | 'past' | 'cancelled' {
  if (status === 'cancelled') return 'cancelled';
  if (now < startsAtUtc) return 'upcoming';
  if (now < endsAtUtc) return 'ongoing';
  return 'past';
}
