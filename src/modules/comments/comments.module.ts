import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { CommentEntityService } from './comment-entity.service';
import { CommentsController } from './comments.controller';
import {
  CreateCommentHandler,
  DeleteCommentHandler,
  ListCommentsHandler,
  UpdateCommentHandler,
} from './handlers';

const handlers = [
  ListCommentsHandler,
  CreateCommentHandler,
  UpdateCommentHandler,
  DeleteCommentHandler,
];

@Module({
  imports: [CqrsModule],
  controllers: [CommentsController],
  providers: [...handlers, CommentEntityService],
})
export class CommentsModule {}
