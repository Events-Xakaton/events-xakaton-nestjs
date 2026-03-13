import { UpdateEventReqDto } from '../dto/request';

export class UpdateEventCommand {
  constructor(
    readonly telegramUserId: string | undefined,
    readonly eventId: string,
    readonly dto: UpdateEventReqDto,
  ) {}
}
