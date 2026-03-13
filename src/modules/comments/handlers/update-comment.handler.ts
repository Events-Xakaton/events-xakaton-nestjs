import { HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { HttpStatusDescriptions } from '../../../shared/constants';
import { GeneralApiResponseDto } from '../../../shared/dto';
import { PrismaService } from '../../../shared/prisma';
import { UserContextService } from '../../../shared/user-context';
import { UpdateCommentCommand } from '../commands';

@CommandHandler(UpdateCommentCommand)
export class UpdateCommentHandler implements ICommandHandler<UpdateCommentCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
  ) {}

  async execute(
    command: UpdateCommentCommand,
  ): Promise<GeneralApiResponseDto<{ status: string }>> {
    const { telegramUserId, commentId, dto } = command;
    const user =
      await this.userContextService.requireUserByTelegram(telegramUserId);

    const trimmed = dto.text.trim();
    if (!trimmed) {
      return new GeneralApiResponseDto(
        HttpStatus.BAD_REQUEST,
        HttpStatusDescriptions[HttpStatus.BAD_REQUEST],
        null as never,
        { message: 'Комментарий не может быть пустым' },
      );
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
        { message: 'Только автор может редактировать комментарий' },
      );
    }

    const entityCheck = await this.checkEntityWritable(
      comment.entityType as 'club' | 'event',
      comment.entityId,
    );
    if (entityCheck) return entityCheck;

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
  ): Promise<GeneralApiResponseDto<never> | null> {
    if (entityType === 'club') {
      const club = await this.prisma.club.findFirst({
        where: { id: entityId, isDeleted: false },
        select: { id: true },
      });
      return club
        ? null
        : new GeneralApiResponseDto(
            HttpStatus.NOT_FOUND,
            HttpStatusDescriptions[HttpStatus.NOT_FOUND],
            null as never,
            { message: 'Клуб не найден' },
          );
    }
    const event = await this.prisma.event.findFirst({
      where: { id: entityId, isDeleted: false },
      select: { id: true, status: true },
    });
    if (!event)
      return new GeneralApiResponseDto(
        HttpStatus.NOT_FOUND,
        HttpStatusDescriptions[HttpStatus.NOT_FOUND],
        null as never,
        { message: 'Событие не найдено' },
      );
    if (event.status === 'cancelled')
      return new GeneralApiResponseDto(
        HttpStatus.BAD_REQUEST,
        HttpStatusDescriptions[HttpStatus.BAD_REQUEST],
        null as never,
        { message: 'Комментарии для отмененных событий недоступны' },
      );
    return null;
  }
}
