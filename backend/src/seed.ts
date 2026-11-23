import { hash, verify } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import { Redis } from 'ioredis';
import { refreshKey } from './auth/refresh-key.js';
import { PrismaClient } from './generated/prisma/client.js';
import { PostStatus } from './generated/prisma/enums.js';
import { deleteByPattern } from './redis/delete-by-pattern.js';

/**
 * Idempotent seed: ensures the admin account from ADMIN_EMAIL/ADMIN_PASSWORD exists
 * (rotating the password when the env value changes). Sample content is only created
 * when SEED_SAMPLE_DATA=true and no posts exist yet.
 */
async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required');
  }
  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD must be at least 12 characters');
  }
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    let adminId: string;
    if (!existing) {
      const admin = await prisma.user.create({
        data: { email, name: 'Admin', passwordHash: await hash(password) },
      });
      adminId = admin.id;
      console.log('seed: admin created');
    } else {
      adminId = existing.id;
      if (!(await verify(existing.passwordHash, password))) {
        await prisma.user.update({
          where: { id: existing.id },
          data: { passwordHash: await hash(password) },
        });
        // A password change must also end sessions opened with the old password.
        await revokeSessions(existing.id);
        console.log('seed: admin password updated, existing sessions revoked');
      }
    }

    if (
      process.env.SEED_SAMPLE_DATA === 'true' &&
      (await prisma.post.count()) === 0
    ) {
      const category = await prisma.category.create({
        data: { name: 'General', slug: 'general' },
      });
      const tag = await prisma.tag.create({
        data: { name: 'Welcome', slug: 'welcome' },
      });
      await prisma.post.create({
        data: {
          title: 'Hello world',
          slug: 'hello-world',
          excerpt: 'The first post on this blog.',
          content:
            '# Hello world\n\nThis is a sample post written in **Markdown**.',
          status: PostStatus.PUBLISHED,
          publishedAt: new Date(),
          authorId: adminId,
          categoryId: category.id,
          tags: { connect: [{ id: tag.id }] },
        },
      });
      console.log('seed: sample content created');
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function revokeSessions(userId: string) {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('REDIS_URL is required to revoke sessions');
  }
  const redis = new Redis(url, {
    lazyConnect: true,
    connectTimeout: 5000,
    maxRetriesPerRequest: 1,
  });
  try {
    await redis.connect();
    await deleteByPattern(redis, refreshKey(userId, '*'));
  } finally {
    redis.disconnect();
  }
}

await main();
