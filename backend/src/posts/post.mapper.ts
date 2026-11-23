import type { Prisma } from '../generated/prisma/client.js';

export const postInclude = {
  category: { select: { id: true, name: true, slug: true } },
  tags: {
    select: { id: true, name: true, slug: true },
    orderBy: { name: 'asc' },
  },
} satisfies Prisma.PostInclude;

type PostWithRelations = Prisma.PostGetPayload<{ include: typeof postInclude }>;

export function toPostSummary(post: PostWithRelations) {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    coverImageUrl: post.coverImageUrl,
    publishedAt: post.publishedAt,
    category: post.category,
    tags: post.tags,
  };
}

export function toPostDetail(post: PostWithRelations) {
  return { ...toPostSummary(post), content: post.content };
}

export function toAdminPost(post: PostWithRelations) {
  return {
    ...toPostDetail(post),
    status: post.status,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}
