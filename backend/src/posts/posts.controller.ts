import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard, type AuthedRequest } from '../auth/admin.guard.js';
import {
  AdminPostQuery,
  CreatePostDto,
  PublicPostQuery,
  UpdatePostDto,
} from './dto/post.dto.js';
import { PostsService } from './posts.service.js';

@Controller('posts')
export class PublicPostsController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  list(@Query() query: PublicPostQuery) {
    return this.posts.listPublished(query);
  }

  @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.posts.getPublishedBySlug(slug);
  }
}

@Controller('admin/posts')
@UseGuards(AdminGuard)
export class AdminPostsController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  list(@Query() query: AdminPostQuery) {
    return this.posts.listAdmin(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.posts.getAdmin(id);
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreatePostDto) {
    return this.posts.create(req.user.sub, dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePostDto) {
    return this.posts.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.posts.remove(id);
  }
}
