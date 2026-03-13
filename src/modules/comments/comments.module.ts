import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

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
  providers: handlers,
})
export class CommentsModule {}
