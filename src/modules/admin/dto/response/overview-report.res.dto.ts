export type OverviewReportResDto = {
  period: { fromUtc: string; toUtc: string };
  users: { total: number; verified: number };
  clubs: { active: number; createdInPeriod: number };
  events: {
    createdInPeriod: number;
    byStatus: {
      upcoming: number;
      ongoing: number;
      past: number;
      cancelled: number;
    };
  };
  engagement: {
    joinsInPeriod: number;
    feedbacksInPeriod: number;
    analyticsEventsInPeriod: number;
    activeUsersInPeriod: number;
  };
  points: { awardedInPeriod: number };
};
