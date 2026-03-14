import { HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { AppException } from '@shared/exceptions';
import { PrismaService } from '@shared/prisma';
import { StatusResDto } from '@shared/types';
import { UserContextService } from '@shared/user-context';

import { UpdateCommentCommand } from '../commands';
import { CommentEntityService } from '../comment-entity.service';

@CommandHandler(UpdateCommentCommand)
export class UpdateCommentHandler implements ICommandHandler<UpdateCommentCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
    private readonly commentEntityService: CommentEntityService,
  ) {}

  async execute(
    command: UpdateCommentCommand,
  ): Promise<StatusResDto> {
    const { telegramUserId, commentId, dto } = command;
    const user =
      await this.userContextService.requireUserByTelegram(telegramUserId);

    const trimmed = dto.text.trim();
    if (!trimmed) {
      throw new AppException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Комментарий не может быть пустым',
      });
    }

    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        authorUserId: true,
        entityType: true,
        entityId: true,
        isDeleted: true,
      },
    });
    if (!comment || comment.isDeleted) {
      throw new AppException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Комментарий не найден',
      });
    }
    if (comment.authorUserId !== user.id) {
      throw new AppException({
        statusCode: HttpStatus.FORBIDDEN,
        message: 'Только автор может редактировать комментарий',
      });
    }

    await this.commentEntityService.checkEntityWritable(
      comment.entityType as 'club' | 'event',
      comment.entityId,
    );

    await this.prisma.comment.update({
      where: { id: commentId },
      data: { text: trimmed },
    });

    return {
      status: 'updated',
    };
  }
}
