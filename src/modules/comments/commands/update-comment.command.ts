import { UpdateCommentReqDto } from '../dto/request';

export class UpdateCommentCommand {
  constructor(
    readonly telegramUserId: string | undefined,
    readonly commentId: string,
    readonly dto: UpdateCommentReqDto,
  ) {}
}
