import { HttpStatus, Injectable } from '@nestjs/common';

import { EventStatus } from '@shared/domain';
import { AppException } from '@shared/exceptions';
import { PrismaService } from '@shared/prisma';

/**
 * Проверяет доступность сущности (club/event) для записи комментариев.
 * Переиспользуется в CreateCommentHandler и UpdateCommentHandler.
 */
@Injectable()
export class CommentEntityService {
  constructor(private readonly prisma: PrismaService) {}

  async checkEntityWritable(
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
    if ((event.status as EventStatus) === EventStatus.Cancelled) {
      throw new AppException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Комментарии для отмененных событий недоступны',
      });
    }
  }
}
