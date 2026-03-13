import { ApiProperty } from '@nestjs/swagger';

class OverviewPeriodDto {
  @ApiProperty() declare fromUtc: string;
  @ApiProperty() declare toUtc: string;
}

class OverviewUsersDto {
  @ApiProperty() declare total: number;
  @ApiProperty() declare verified: number;
}

class OverviewClubsDto {
  @ApiProperty() declare active: number;
  @ApiProperty() declare createdInPeriod: number;
}

class OverviewEventsByStatusDto {
  @ApiProperty() declare upcoming: number;
  @ApiProperty() declare ongoing: number;
  @ApiProperty() declare past: number;
  @ApiProperty() declare cancelled: number;
}

class OverviewEventsDto {
  @ApiProperty() declare createdInPeriod: number;
  @ApiProperty({ type: OverviewEventsByStatusDto })
  declare byStatus: OverviewEventsByStatusDto;
}

class OverviewEngagementDto {
  @ApiProperty() declare joinsInPeriod: number;
  @ApiProperty() declare feedbacksInPeriod: number;
  @ApiProperty() declare analyticsEventsInPeriod: number;
  @ApiProperty() declare activeUsersInPeriod: number;
}

class OverviewPointsDto {
  @ApiProperty() declare awardedInPeriod: number;
}

export class OverviewReportResDto {
  @ApiProperty({ type: OverviewPeriodDto })
  declare period: OverviewPeriodDto;

  @ApiProperty({ type: OverviewUsersDto })
  declare users: OverviewUsersDto;

  @ApiProperty({ type: OverviewClubsDto })
  declare clubs: OverviewClubsDto;

  @ApiProperty({ type: OverviewEventsDto })
  declare events: OverviewEventsDto;

  @ApiProperty({ type: OverviewEngagementDto })
  declare engagement: OverviewEngagementDto;

  @ApiProperty({ type: OverviewPointsDto })
  declare points: OverviewPointsDto;
}
