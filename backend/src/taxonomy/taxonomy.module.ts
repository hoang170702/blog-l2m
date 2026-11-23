import { Module } from '@nestjs/common';
import { PostsModule } from '../posts/posts.module.js';
import { taxonomyControllers } from './taxonomy.controller.js';
import { TaxonomyService } from './taxonomy.service.js';

@Module({
  imports: [PostsModule],
  controllers: taxonomyControllers,
  providers: [TaxonomyService],
})
export class TaxonomyModule {}
