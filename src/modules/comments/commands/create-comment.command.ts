import { CreateCommentReqDto } from '../dto/request';

export class CreateCommentCommand {
  constructor(
    readonly telegramUserId: string | undefined,
    readonly dto: CreateCommentReqDto,
  ) {}
}
