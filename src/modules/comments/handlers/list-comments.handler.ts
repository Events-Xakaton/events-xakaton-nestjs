import { HttpStatus } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { HttpStatusDescriptions } from '@shared/constants';
import { GeneralApiResponseDto } from '@shared/dto';
import { PrismaService } from '@shared/prisma';

import { CommentItemResDto } from '../dto/response';
import { ListCommentsQuery } from '../queries';

@QueryHandler(ListCommentsQuery)
export class ListCommentsHandler implements IQueryHandler<ListCommentsQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: ListCommentsQuery,
  ): Promise<GeneralApiResponseDto<CommentItemResDto[]>> {
    const { entityType, entityId } = query;

    const comments = await this.prisma.comment.findMany({
      where: { entityType, entityId, isDeleted: false },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { telegramUserId: true, fullName: true } } },
      take: 500,
    });

    const items = comments.map(
      (c) =>
        new CommentItemResDto({
          id: c.id,
          authorTelegramUserId: c.author.telegramUserId.toString(),
          authorName: c.author.fullName,
          text: c.text,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        }),
    );

    return new GeneralApiResponseDto(
      HttpStatus.OK,
      HttpStatusDescriptions[HttpStatus.OK],
      items,
    );
  }
}
