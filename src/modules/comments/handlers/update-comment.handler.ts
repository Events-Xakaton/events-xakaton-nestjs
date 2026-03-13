import { HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { HttpStatusDescriptions } from '@shared/constants';
import { GeneralApiResponseDto } from '@shared/dto';
import { StatusResDto } from '@shared/types';
import { AppException } from '@shared/exceptions';
import { PrismaService } from '@shared/prisma';
import { UserContextService } from '@shared/user-context';

import { UpdateCommentCommand } from '../commands';

@CommandHandler(UpdateCommentCommand)
export class UpdateCommentHandler implements ICommandHandler<UpdateCommentCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
  ) {}

  async execute(
    command: UpdateCommentCommand,
  ): Promise<GeneralApiResponseDto<StatusResDto>> {
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

    await this.checkEntityWritable(
      comment.entityType as 'club' | 'event',
      comment.entityId,
    );

    await this.prisma.comment.update({
      where: { id: commentId },
      data: { text: trimmed },
    });

    return new GeneralApiResponseDto(
      HttpStatus.OK,
      HttpStatusDescriptions[HttpStatus.OK],
      {
        status: 'updated',
      },
    );
  }

  private async checkEntityWritable(
    entityType: 'club' | 'event',
    entityId: string,
  ): Promise<void> {
    if (entityType === 'club') {
      const club = await this.prisma.club.findFirst({
        where: { id: entityId, isDeleted: false },
        select: { id: true },
      });
      if (!club) {
        throw new AppException({
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Клуб не найден',
        });
      }
      return;
    }
    const event = await this.prisma.event.findFirst({
      where: { id: entityId, isDeleted: false },
      select: { id: true, status: true },
    });
    if (!event) {
      throw new AppException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Событие не найдено',
      });
    }
    if (event.status === 'cancelled') {
      throw new AppException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Комментарии для отмененных событий недоступны',
      });
    }
  }
}
