import { Injectable, NotFoundException } from '@nestjs/common';
import type { Page } from '../common/pagination.js';
import { uniqueSlug } from '../common/slug.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PostStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  AdminPostQuery,
  CreatePostDto,
  PublicPostQuery,
  UpdatePostDto,
} from './dto/post.dto.js';
import {
  DETAIL_TTL_SECONDS,
  LIST_TTL_SECONDS,
  PostCacheService,
} from './post-cache.service.js';
import {
  postInclude,
  toAdminPost,
  toPostDetail,
  toPostSummary,
} from './post.mapper.js';

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: PostCacheService,
  ) {}

  listPublished(
    query: PublicPostQuery,
  ): Promise<Page<ReturnType<typeof toPostSummary>>> {
    const { page, limit, category, tag, q } = query;
    const key = this.cache.listKey({ page, limit, category, tag, q });
    return this.cache.getOrLoad(key, LIST_TTL_SECONDS, async () => {
      const where: Prisma.PostWhereInput = {
        status: PostStatus.PUBLISHED,
        ...(category ? { category: { slug: category } } : {}),
        ...(tag ? { tags: { some: { slug: tag } } } : {}),
        ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
      };
      const [items, total] = await this.prisma.$transaction([
        this.prisma.post.findMany({
          where,
          include: postInclude,
          orderBy: { publishedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.post.count({ where }),
      ]);
      return { items: items.map(toPostSummary), total, page, limit };
    });
  }

  async getPublishedBySlug(slug: string) {
    const post = await this.cache.getOrLoad(
      this.cache.detailKey(slug),
      DETAIL_TTL_SECONDS,
      async () => {
        const found = await this.prisma.post.findFirst({
          where: { slug, status: PostStatus.PUBLISHED },
          include: postInclude,
        });
        return found ? toPostDetail(found) : null;
      },
    );
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    return post;
  }

  async listAdmin(query: AdminPostQuery) {
    const { page, limit, status } = query;
    const where: Prisma.PostWhereInput = status ? { status } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where,
        include: postInclude,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.post.count({ where }),
    ]);
    return { items: items.map(toAdminPost), total, page, limit };
  }

  async getAdmin(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: postInclude,
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    return toAdminPost(post);
  }

  async create(authorId: string, dto: CreatePostDto) {
    const slug = await uniqueSlug(dto.slug ?? dto.title, (s) =>
      this.slugTaken(s),
    );
    const status = dto.status ?? PostStatus.DRAFT;
    const post = await this.prisma.post.create({
      data: {
        title: dto.title,
        slug,
        excerpt: dto.excerpt,
        content: dto.content,
        coverImageUrl: dto.coverImageUrl,
        status,
        publishedAt: status === PostStatus.PUBLISHED ? new Date() : null,
        author: { connect: { id: authorId } },
        ...(dto.categoryId
          ? { category: { connect: { id: dto.categoryId } } }
          : {}),
        tags: { connect: (dto.tagIds ?? []).map((id) => ({ id })) },
      },
      include: postInclude,
    });
    await this.cache.invalidateAll();
    return toAdminPost(post);
  }

  async update(id: string, dto: UpdatePostDto) {
    const existing = await this.prisma.post.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Post not found');
    }
    const slug =
      dto.slug && dto.slug !== existing.slug
        ? await uniqueSlug(dto.slug, (s) => this.slugTaken(s, id))
        : undefined;
    // publishedAt is set on the first publish and kept afterwards.
    const publishedAt =
      dto.status === PostStatus.PUBLISHED && !existing.publishedAt
        ? new Date()
        : undefined;
    const post = await this.prisma.post.update({
      where: { id },
      data: {
        title: dto.title,
        slug,
        excerpt: dto.excerpt,
        content: dto.content,
        coverImageUrl: dto.coverImageUrl,
        status: dto.status,
        publishedAt,
        ...(dto.categoryId !== undefined
          ? {
              category: dto.categoryId
                ? { connect: { id: dto.categoryId } }
                : { disconnect: true },
            }
          : {}),
        ...(dto.tagIds
          ? { tags: { set: dto.tagIds.map((tagId) => ({ id: tagId })) } }
          : {}),
      },
      include: postInclude,
    });
    await this.cache.invalidateAll();
    return toAdminPost(post);
  }

  async remove(id: string) {
    await this.prisma.post.delete({ where: { id } });
    await this.cache.invalidateAll();
  }

  private async slugTaken(slug: string, exceptId?: string) {
    const found = await this.prisma.post.findUnique({
      where: { slug },
      select: { id: true },
    });
    return found !== null && found.id !== exceptId;
  }
}
