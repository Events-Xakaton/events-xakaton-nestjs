import { EventFeedbackReqDto } from '../dto/request';

export class SubmitEventFeedbackCommand {
  constructor(
    readonly telegramUserId: string | undefined,
    readonly eventId: string,
    readonly dto: EventFeedbackReqDto,
  ) {}
}
