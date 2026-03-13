/**
 * Возвращает диапазон дат для текущей недели или месяца (UTC).
 * Неделя начинается с понедельника.
 *
 * @example
 * const { start, end } = getPeriodRange('weekly');
 * prisma.pointsLedger.groupBy({ where: { createdAt: { gte: start, lt: end } } });
 */
export function getPeriodRange(period: 'weekly' | 'monthly'): {
  start: Date;
  end: Date;
} {
  const now = new Date();
  if (period === 'weekly') {
    const diffToMonday = (now.getUTCDay() + 6) % 7;
    const start = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - diffToMonday,
      ),
    );
    return {
      start,
      end: new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000),
    };
  }
  return {
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  };
}
