import { HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { HttpStatusDescriptions } from '@shared/constants';
import { GeneralApiResponseDto } from '@shared/dto';
import { AppException } from '@shared/exceptions';
import { PrismaService } from '@shared/prisma';
import { IdResDto } from '@shared/types';
import { UserContextService } from '@shared/user-context';

import { CreateCommentCommand } from '../commands';
import { CommentEntityService } from '../comment-entity.service';

@CommandHandler(CreateCommentCommand)
export class CreateCommentHandler implements ICommandHandler<CreateCommentCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContextService: UserContextService,
    private readonly commentEntityService: CommentEntityService,
  ) {}

  async execute(
    command: CreateCommentCommand,
  ): Promise<GeneralApiResponseDto<IdResDto>> {
    const { telegramUserId, dto } = command;
    const user =
      await this.userContextService.requireUserByTelegram(telegramUserId);

    const trimmed = dto.text.trim();
    if (!trimmed) {
      throw new AppException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Комментарий не может быть пустым',
      });
    }

    await this.commentEntityService.checkEntityWritable(
      dto.entityType,
      dto.entityId,
    );

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
      throw new AppException({
        statusCode: HttpStatus.CONFLICT,
        message: 'Обнаружен дублирующий комментарий',
      });
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
}
