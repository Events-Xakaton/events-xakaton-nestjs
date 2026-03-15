import { RANKS } from '@shared/constants';

export interface RankInfo {
  level: number;
  title: string;
  /** Отображаемая метка — «Ур. 7 · Коннектор» */
  label: string;
  /** Очков до следующего уровня; null на максимальном уровне */
  pointsToNextLevel: number | null;
}

export function computeRank(lifetimePoints: number): RankInfo {
  let current: (typeof RANKS)[number] = RANKS[0];
  for (const rank of RANKS) {
    if (lifetimePoints >= rank.minPoints) {
      current = rank;
    }
  }
  const nextRank = RANKS.find((r) => r.level === current.level + 1) ?? null;
  return {
    level: current.level,
    title: current.title,
    label: `Ур. ${current.level} · ${current.title}`,
    pointsToNextLevel: nextRank ? nextRank.minPoints - lifetimePoints : null,
  };
}
