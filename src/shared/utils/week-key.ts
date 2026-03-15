/**
 * Возвращает "YYYY-MM-DD" даты UTC-понедельника текущей (или заданной) недели.
 * Используется как ключ недельного лимита Lucky Wheel.
 */
export function getWeekKey(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=вс, 1=пн ... 6=сб
  const diff = day === 0 ? -6 : 1 - day; // сдвиг до ближайшего прошедшего пн
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}
