import { Module } from '@nestjs/common';
import {
  AdminCommentsController,
  PublicCommentsController,
} from './comments.controller.js';
import { CommentsService } from './comments.service.js';

@Module({
  controllers: [PublicCommentsController, AdminCommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
