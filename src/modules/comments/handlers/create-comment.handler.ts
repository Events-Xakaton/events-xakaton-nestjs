import { HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { HttpStatusDescriptions } from '@shared/constants';
import { GeneralApiResponseDto } from '@shared/dto';
import { PrismaService } from '@shared/prisma';
import { UserContextService } from '@shared/user-context';

import { CreateCommentCommand } from '../commands';

@CommandHandler(CreateCommentCommand)
export class CreateCommentHandler implements ICommandHandler<CreateCommentCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
  ) {}

  async execute(
    command: CreateCommentCommand,
  ): Promise<GeneralApiResponseDto<{ id: string }>> {
    const { telegramUserId, dto } = command;
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

    const entityCheck = await this.checkEntityWritable(
      dto.entityType,
      dto.entityId,
    );
    if (entityCheck) return entityCheck;

    // Защита от двойного нажатия: дубль в течение 30 сек не допускается
    const threshold = new Date(Date.now() - 30 * 1000);
    const duplicate = await this.prisma.comment.findFirst({
      where: {
        authorUserId: user.id,
        entityType: dto.entityType,
        entityId: dto.entityId,
        isDeleted: false,
        text: trimmed,
        createdAt: { gte: threshold },
      },
      select: { id: true },
    });
    if (duplicate) {
      return new GeneralApiResponseDto(
        HttpStatus.CONFLICT,
        HttpStatusDescriptions[HttpStatus.CONFLICT],
        null as never,
        { message: 'Обнаружен дублирующий комментарий' },
      );
    }

    const comment = await this.prisma.comment.create({
      data: {
        entityType: dto.entityType,
        entityId: dto.entityId,
        authorUserId: user.id,
        text: trimmed,
      },
      select: { id: true },
    });

    return new GeneralApiResponseDto(
      HttpStatus.CREATED,
      HttpStatusDescriptions[HttpStatus.CREATED],
      {
        id: comment.id,
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
      if (!club) {
        return new GeneralApiResponseDto(
          HttpStatus.NOT_FOUND,
          HttpStatusDescriptions[HttpStatus.NOT_FOUND],
          null as never,
          { message: 'Клуб не найден' },
        );
      }
      return null;
    }
    const event = await this.prisma.event.findFirst({
      where: { id: entityId, isDeleted: false },
      select: { id: true, status: true },
    });
    if (!event) {
      return new GeneralApiResponseDto(
        HttpStatus.NOT_FOUND,
        HttpStatusDescriptions[HttpStatus.NOT_FOUND],
        null as never,
        { message: 'Событие не найдено' },
      );
    }
    if (event.status === 'cancelled') {
      return new GeneralApiResponseDto(
        HttpStatus.BAD_REQUEST,
        HttpStatusDescriptions[HttpStatus.BAD_REQUEST],
        null as never,
        { message: 'Комментарии для отмененных событий недоступны' },
      );
    }
    return null;
  }
}
