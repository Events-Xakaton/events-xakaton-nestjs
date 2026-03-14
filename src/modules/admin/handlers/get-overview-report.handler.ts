import { HttpStatus } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { EventParticipationStatus, EventStatus } from '@shared/domain';
import { PrismaService } from '@shared/prisma';

import { OverviewReportResDto } from '../dto/response';
import { GetOverviewReportQuery } from '../queries';

@QueryHandler(GetOverviewReportQuery)
export class GetOverviewReportHandler implements IQueryHandler<GetOverviewReportQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: GetOverviewReportQuery,
  ): Promise<OverviewReportResDto> {
    const fromUtc = query.range.fromUtc
      ? new Date(query.range.fromUtc)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toUtc = query.range.toUtc ? new Date(query.range.toUtc) : new Date();

    const [
      usersTotal,
      usersVerified,
      clubsActive,
      clubsCreatedInPeriod,
      eventsCreatedInPeriod,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isVerified: true } }),
      this.prisma.club.count({ where: { isDeleted: false } }),
      this.prisma.club.count({
        where: { createdAt: { gte: fromUtc, lte: toUtc } },
      }),
      this.prisma.event.count({
        where: { createdAt: { gte: fromUtc, lte: toUtc } },
      }),
    ]);

    const [eventsUpcoming, eventsOngoing, eventsPast, eventsCancelled] =
      await Promise.all([
        this.prisma.event.count({ where: { status: EventStatus.Upcoming } }),
        this.prisma.event.count({ where: { status: EventStatus.Ongoing } }),
        this.prisma.event.count({ where: { status: EventStatus.Past } }),
        this.prisma.event.count({ where: { status: EventStatus.Cancelled } }),
      ]);

    const [
      joinsInPeriod,
      feedbacksInPeriod,
      analyticsEventsInPeriod,
      activeUsers,
      awardedRaw,
    ] = await Promise.all([
      this.prisma.eventParticipation.count({
        where: {
          status: EventParticipationStatus.Joined,
          joinedAt: { gte: fromUtc, lte: toUtc },
        },
      }),
      this.prisma.eventFeedback.count({
        where: { submittedAt: { gte: fromUtc, lte: toUtc } },
      }),
      this.prisma.analyticsEvent.count({
        where: { occurredAt: { gte: fromUtc, lte: toUtc } },
      }),
      this.prisma.analyticsEvent.findMany({
        where: {
          occurredAt: { gte: fromUtc, lte: toUtc },
          userId: { not: null },
        },
        select: { userId: true },
        distinct: ['userId'],
      }),
      this.prisma.pointsLedger.aggregate({
        _sum: { deltaPoints: true },
        where: {
          createdAt: { gte: fromUtc, lte: toUtc },
          deltaPoints: { gt: 0 },
        },
      }),
    ]);

    return {
      period: { fromUtc: fromUtc.toISOString(), toUtc: toUtc.toISOString() },
      users: { total: usersTotal, verified: usersVerified },
      clubs: { active: clubsActive, createdInPeriod: clubsCreatedInPeriod },
      events: {
        createdInPeriod: eventsCreatedInPeriod,
        byStatus: {
          upcoming: eventsUpcoming,
          ongoing: eventsOngoing,
          past: eventsPast,
          cancelled: eventsCancelled,
        },
      },
      engagement: {
        joinsInPeriod,
        feedbacksInPeriod,
        analyticsEventsInPeriod,
        activeUsersInPeriod: activeUsers.length,
      },
      points: { awardedInPeriod: awardedRaw._sum.deltaPoints ?? 0 },
    };
  }
}
