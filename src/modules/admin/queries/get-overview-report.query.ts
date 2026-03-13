import { ReportRangeDto } from '../dto/report-range.dto';

export class GetOverviewReportQuery {
  constructor(readonly range: ReportRangeDto) {}
}
