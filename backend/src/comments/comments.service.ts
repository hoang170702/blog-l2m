import { Injectable, NotFoundException } from '@nestjs/common';
import { CommentStatus, PostStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AdminCommentQuery, CreateCommentDto } from './dto/comment.dto.js';

const publicSelect = {
  id: true,
  authorName: true,
  content: true,
  createdAt: true,
} as const;

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listApproved(slug: string) {
    const post = await this.findPublishedPost(slug);
    return this.prisma.comment.findMany({
      where: { postId: post.id, status: CommentStatus.APPROVED },
      select: publicSelect,
      orderBy: { createdAt: 'asc' },
    });
  }

  async submit(slug: string, dto: CreateCommentDto) {
    const post = await this.findPublishedPost(slug);
    const comment = await this.prisma.comment.create({
      data: {
        postId: post.id,
        authorName: dto.authorName,
        content: dto.content,
      },
    });
    return { id: comment.id, status: comment.status };
  }

  async listAdmin(query: AdminCommentQuery) {
    const { page, limit, status } = query;
    const where = status ? { status } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.comment.findMany({
        where,
        select: {
          ...publicSelect,
          status: true,
          postId: true,
          post: { select: { title: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.comment.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  moderate(id: string, status: CommentStatus) {
    return this.prisma.comment.update({
      where: { id },
      data: { status },
      select: { ...publicSelect, status: true, postId: true },
    });
  }

  async remove(id: string) {
    await this.prisma.comment.delete({ where: { id } });
  }

  private async findPublishedPost(slug: string) {
    const post = await this.prisma.post.findFirst({
      where: { slug, status: PostStatus.PUBLISHED },
      select: { id: true },
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    return post;
  }
}
