import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { PAGINATION } from '@shared/constants';
import { PrismaService } from '@shared/prisma';

import { CommentItemResDto } from '../dto/response';
import { ListCommentsQuery } from '../queries';

@QueryHandler(ListCommentsQuery)
export class ListCommentsHandler implements IQueryHandler<ListCommentsQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: ListCommentsQuery,
  ): Promise<CommentItemResDto[]> {
    const { entityType, entityId } = query;

    const comments = await this.prisma.comment.findMany({
      where: { entityType, entityId, isDeleted: false },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { telegramUserId: true, fullName: true } } },
      take: PAGINATION.COMMENTS_LIST_LIMIT,
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

    return items;
  }
}
