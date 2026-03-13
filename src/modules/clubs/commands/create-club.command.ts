import { CreateClubReqDto } from '../dto/request';

export class CreateClubCommand {
  constructor(
    public readonly telegramUserId: string | undefined,
    public readonly dto: CreateClubReqDto,
  ) {}
}
