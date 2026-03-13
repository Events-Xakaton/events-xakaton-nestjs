export type LeaderboardEntryResDto = {
  rank: number;
  userId: string;
  fullName: string;
  points: number;
};

export type LeaderboardResDto = {
  period: 'weekly' | 'monthly';
  top: LeaderboardEntryResDto[];
  currentUser: LeaderboardEntryResDto | null;
};
