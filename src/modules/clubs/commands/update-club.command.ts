import { UpdateClubReqDto } from '../dto/request';

export class UpdateClubCommand {
  constructor(
    public readonly telegramUserId: string | undefined,
    public readonly clubId: string,
    public readonly dto: UpdateClubReqDto,
  ) {}
}
