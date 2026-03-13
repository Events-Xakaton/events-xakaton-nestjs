import { HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { HttpStatusDescriptions } from '../../../shared/constants';
import { GeneralApiResponseDto } from '../../../shared/dto';
import { PrismaService } from '../../../shared/prisma';
import { UserContextService } from '../../../shared/user-context';
import { DeleteCommentCommand } from '../commands';

@CommandHandler(DeleteCommentCommand)
export class DeleteCommentHandler implements ICommandHandler<DeleteCommentCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
  ) {}

  async execute(
    command: DeleteCommentCommand,
  ): Promise<GeneralApiResponseDto<{ status: string }>> {
    const { telegramUserId, commentId } = command;
    const user =
      await this.userContextService.requireUserByTelegram(telegramUserId);

    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, authorUserId: true, isDeleted: true },
    });
    if (!comment || comment.isDeleted) {
      return new GeneralApiResponseDto(
        HttpStatus.NOT_FOUND,
        HttpStatusDescriptions[HttpStatus.NOT_FOUND],
        null as never,
        { message: 'Комментарий не найден' },
      );
    }
    if (comment.authorUserId !== user.id) {
      return new GeneralApiResponseDto(
        HttpStatus.FORBIDDEN,
        HttpStatusDescriptions[HttpStatus.FORBIDDEN],
        null as never,
        { message: 'Только автор может удалить комментарий' },
      );
    }

    await this.prisma.comment.update({
      where: { id: commentId },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    return new GeneralApiResponseDto(
      HttpStatus.OK,
      HttpStatusDescriptions[HttpStatus.OK],
      {
        status: 'deleted',
      },
    );
  }
}
