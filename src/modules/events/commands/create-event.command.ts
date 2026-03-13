import { CreateEventReqDto } from '../dto/request';

export class CreateEventCommand {
  constructor(
    readonly telegramUserId: string | undefined,
    readonly dto: CreateEventReqDto,
  ) {}
}
