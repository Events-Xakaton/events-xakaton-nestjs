/**
 * Таблица уровней геймификации — единственный источник правды.
 * Ранг вычисляется на лету по lifetime-сумме очков пользователя.
 */
export const RANKS = [
  { level: 1, title: 'Новичок', minPoints: 0 },
  { level: 2, title: 'Исследователь', minPoints: 15 },
  { level: 3, title: 'Участник', minPoints: 40 },
  { level: 4, title: 'Тусовщик', minPoints: 90 },
  { level: 5, title: 'Завсегдатай', minPoints: 170 },
  { level: 6, title: 'Организатор', minPoints: 290 },
  { level: 7, title: 'Коннектор', minPoints: 450 },
  { level: 8, title: 'Амбассадор', minPoints: 660 },
  { level: 9, title: 'Легенда', minPoints: 940 },
  { level: 10, title: 'Гуру', minPoints: 1300 },
] as const;
