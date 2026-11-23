import { Module } from '@nestjs/common';
import { PostCacheService } from './post-cache.service.js';
import {
  AdminPostsController,
  PublicPostsController,
} from './posts.controller.js';
import { PostsService } from './posts.service.js';

@Module({
  controllers: [PublicPostsController, AdminPostsController],
  providers: [PostsService, PostCacheService],
  exports: [PostCacheService],
})
export class PostsModule {}
