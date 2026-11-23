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
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AdminGuard } from '../auth/admin.guard.js';
import { CommentsService } from './comments.service.js';
import {
  AdminCommentQuery,
  CreateCommentDto,
  ModerateCommentDto,
} from './dto/comment.dto.js';

@Controller('posts/:slug/comments')
export class PublicCommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  list(@Param('slug') slug: string) {
    return this.comments.listApproved(slug);
  }

  @Post()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  submit(@Param('slug') slug: string, @Body() dto: CreateCommentDto) {
    return this.comments.submit(slug, dto);
  }
}

@Controller('admin/comments')
@UseGuards(AdminGuard)
export class AdminCommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  list(@Query() query: AdminCommentQuery) {
    return this.comments.listAdmin(query);
  }

  @Patch(':id')
  moderate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModerateCommentDto,
  ) {
    return this.comments.moderate(id, dto.status);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.comments.remove(id);
  }
}
