import { ConfirmAttendanceReqDto } from '../dto/request/confirm-attendance.req.dto';

export class ConfirmAttendanceCommand {
  constructor(
    readonly telegramUserId: string | undefined,
    readonly eventId: string,
    readonly dto: ConfirmAttendanceReqDto,
  ) {}
}
