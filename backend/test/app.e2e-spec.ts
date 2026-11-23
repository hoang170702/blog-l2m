import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import type { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { REDIS } from '../src/redis/redis.module.js';
import { setupApp } from '../src/setup-app.js';

const ADMIN = {
  email: 'e2e-admin@example.com',
  password: 'e2e-admin-password',
};
const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
    '1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082',
  'hex',
);

describe('Blog API (e2e)', () => {
  let app: NestExpressApplication;
  let http: App;
  let prisma: PrismaService;
  let redis: Redis;
  let uploadDir: string;
  // Each test gets its own client IP so rate limits do not leak between tests.
  let ip: string;
  const api = () => request(http);

  beforeAll(async () => {
    // These tests truncate every table; refuse to run against anything but a local database.
    const dbHost = new URL(process.env.DATABASE_URL ?? 'postgresql://localhost')
      .hostname;
    if (!['localhost', '127.0.0.1', 'postgres'].includes(dbHost)) {
      throw new Error(
        `Refusing to run e2e tests against database host "${dbHost}"`,
      );
    }
    uploadDir = await mkdtemp(join(tmpdir(), 'blog-e2e-'));
    process.env.UPLOAD_DIR = uploadDir;
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    setupApp(app);
    await app.init();
    http = app.getHttpServer();
    prisma = app.get(PrismaService);
    redis = app.get(REDIS);
  });

  beforeEach(async () => {
    ip = `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
    await prisma.$executeRawUnsafe(
      'TRUNCATE "Comment", "_PostToTag", "Post", "Tag", "Category", "User" CASCADE',
    );
    await redis.flushdb();
    await prisma.user.create({
      data: {
        email: ADMIN.email,
        name: 'Admin',
        passwordHash: await hash(ADMIN.password),
      },
    });
  });

  afterAll(async () => {
    await app.close();
    await rm(uploadDir, { recursive: true, force: true });
  });

  async function login() {
    const res = await api()
      .post('/api/auth/login')
      .set('X-Forwarded-For', ip)
      .send(ADMIN)
      .expect(200);
    const cookie = [res.headers['set-cookie']].flat()[0] as string;
    return {
      token: res.body.accessToken as string,
      cookie: cookie.split(';')[0],
    };
  }

  it('reports healthy dependencies', async () => {
    await api()
      .get('/api/health')
      .expect(200, { status: 'ok', db: 'up', redis: 'up' });
  });

  describe('auth', () => {
    it('rejects wrong credentials', async () => {
      await api()
        .post('/api/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ ...ADMIN, password: 'wrong' })
        .expect(401);
    });

    it('sets an httpOnly refresh cookie scoped to /api/auth', async () => {
      const res = await api()
        .post('/api/auth/login')
        .set('X-Forwarded-For', ip)
        .send(ADMIN);
      const cookie = [res.headers['set-cookie']].flat()[0] as string;
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/Path=\/api\/auth/);
      expect(cookie).toMatch(/SameSite=Strict/);
    });

    async function rotate(cookie: string) {
      const res = await api()
        .post('/api/auth/refresh')
        .set('Cookie', cookie)
        .expect(200);
      expect(res.body.accessToken).toEqual(expect.any(String));
      return ([res.headers['set-cookie']].flat()[0] as string).split(';')[0];
    }

    it('tolerates a concurrent refresh with the same token', async () => {
      const { cookie } = await login();
      const newCookie = await rotate(cookie);

      // A second tab refreshing at the same moment: rejected, but nothing is revoked
      // and the browser's newer cookie is not cleared.
      const race = await api()
        .post('/api/auth/refresh')
        .set('Cookie', cookie)
        .expect(401);
      expect(race.headers['set-cookie']).toBeUndefined();
      await rotate(newCookie);
    });

    it('revokes every session when an old refresh token is replayed later', async () => {
      const { cookie } = await login();
      const newCookie = await rotate(cookie);
      // Simulate the rotation grace period running out: forget rotated tokens only.
      for (const key of await redis.keys('refresh:*')) {
        if ((await redis.get(key)) === 'rotated') await redis.del(key);
      }

      // Replaying the old token now looks like theft: it fails and kills the live session.
      await api().post('/api/auth/refresh').set('Cookie', cookie).expect(401);
      await api()
        .post('/api/auth/refresh')
        .set('Cookie', newCookie)
        .expect(401);
    });

    it('logout invalidates the refresh token', async () => {
      const { cookie } = await login();
      await api().post('/api/auth/logout').set('Cookie', cookie).expect(204);
      await api().post('/api/auth/refresh').set('Cookie', cookie).expect(401);
    });

    it('returns the current user for a valid access token', async () => {
      const { token } = await login();
      const res = await api()
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ email: ADMIN.email, role: 'ADMIN' });
    });

    it('rate limits login attempts per client IP', async () => {
      for (let i = 0; i < 5; i++) {
        await api()
          .post('/api/auth/login')
          .set('X-Forwarded-For', ip)
          .send({ ...ADMIN, password: 'wrong' })
          .expect(401);
      }
      await api()
        .post('/api/auth/login')
        .set('X-Forwarded-For', ip)
        .send(ADMIN)
        .expect(429);
    });
  });

  describe('admin access control', () => {
    it.each([
      ['get', '/api/admin/posts'],
      ['post', '/api/admin/categories'],
      ['get', '/api/admin/comments'],
      ['post', '/api/admin/uploads'],
    ] as const)('%s %s requires a token', async (method, path) => {
      await api()[method](path).expect(401);
    });

    it('rejects a forged token', async () => {
      await api()
        .get('/api/admin/posts')
        .set('Authorization', 'Bearer abc.def.ghi')
        .expect(401);
    });
  });

  describe('content flow', () => {
    it('generates unique, non-empty slugs for categories and tags', async () => {
      const { token } = await login();
      const create = (name: string) =>
        api()
          .post('/api/admin/tags')
          .set('Authorization', `Bearer ${token}`)
          .send({ name })
          .expect(201)
          .then((res) => res.body.slug as string);

      expect(await create('C++')).toBe('c');
      expect(await create('C#')).toBe('c-2');
      expect(await create('🚀')).toBe('item');
    });

    it('publishes a post, caches it and moderates comments', async () => {
      const { token } = await login();
      const auth = { Authorization: `Bearer ${token}` };

      const category = await api()
        .post('/api/admin/categories')
        .set(auth)
        .send({ name: 'Công nghệ' })
        .expect(201);
      expect(category.body.slug).toBe('cong-nghe');
      const tag = await api()
        .post('/api/admin/tags')
        .set(auth)
        .send({ name: 'NestJS' })
        .expect(201);
      await api()
        .post('/api/admin/tags')
        .set(auth)
        .send({ name: 'NestJS' })
        .expect(409);

      const draft = await api()
        .post('/api/admin/posts')
        .set(auth)
        .send({
          title: 'Hello World',
          content: '# Hi',
          categoryId: category.body.id,
          tagIds: [tag.body.id],
        })
        .expect(201);
      expect(draft.body).toMatchObject({
        slug: 'hello-world',
        status: 'DRAFT',
        publishedAt: null,
      });

      // Drafts are invisible publicly.
      await api().get('/api/posts/hello-world').expect(404);
      expect((await api().get('/api/posts').expect(200)).body.total).toBe(0);

      const published = await api()
        .patch(`/api/admin/posts/${draft.body.id}`)
        .set(auth)
        .send({ status: 'PUBLISHED' })
        .expect(200);
      expect(published.body.publishedAt).not.toBeNull();

      const list = await api()
        .get('/api/posts?category=cong-nghe&tag=nestjs')
        .expect(200);
      expect(list.body).toMatchObject({ total: 1, page: 1, limit: 10 });
      expect(list.body.items[0]).not.toHaveProperty('content');
      const detail = await api().get('/api/posts/hello-world').expect(200);
      expect(detail.body).toMatchObject({
        title: 'Hello World',
        content: '# Hi',
      });
      expect(await redis.exists('cache:posts:slug:hello-world')).toBe(1);

      // A write invalidates cached pages.
      await api()
        .patch(`/api/admin/posts/${draft.body.id}`)
        .set(auth)
        .send({ title: 'Hello Again' })
        .expect(200);
      expect(await redis.exists('cache:posts:slug:hello-world')).toBe(0);
      expect((await api().get('/api/posts/hello-world')).body.title).toBe(
        'Hello Again',
      );

      const second = await api()
        .post('/api/admin/posts')
        .set(auth)
        .send({ title: 'Hello World', content: 'x' })
        .expect(201);
      expect(second.body.slug).toBe('hello-world-2');

      const submitted = await api()
        .post('/api/posts/hello-world/comments')
        .set('X-Forwarded-For', ip)
        .send({ authorName: 'Guest', content: 'Nice post' })
        .expect(201);
      expect(submitted.body.status).toBe('PENDING');
      expect(
        (await api().get('/api/posts/hello-world/comments').expect(200)).body,
      ).toEqual([]);

      await api()
        .patch(`/api/admin/comments/${submitted.body.id}`)
        .set(auth)
        .send({ status: 'APPROVED' })
        .expect(200);
      const comments = await api()
        .get('/api/posts/hello-world/comments')
        .expect(200);
      expect(comments.body).toEqual([
        expect.objectContaining({ authorName: 'Guest', content: 'Nice post' }),
      ]);
      expect(comments.body[0]).not.toHaveProperty('status');
    });

    it('accepts long multi-byte posts up to the content limit', async () => {
      const { token } = await login();
      await api()
        .post('/api/admin/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Bài dài', content: 'ạ'.repeat(150_000) })
        .expect(201);
    });

    it('validates input and rejects unknown fields', async () => {
      const { token } = await login();
      await api()
        .post('/api/admin/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: '', content: 'x', authorId: randomUUID() })
        .expect(400);
    });

    it('limits comment submissions per IP', async () => {
      const { token } = await login();
      await api()
        .post('/api/admin/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Open', content: 'x', status: 'PUBLISHED' })
        .expect(201);
      for (let i = 0; i < 3; i++) {
        await api()
          .post('/api/posts/open/comments')
          .set('X-Forwarded-For', ip)
          .send({ authorName: 'G', content: `c${i}` })
          .expect(201);
      }
      await api()
        .post('/api/posts/open/comments')
        .set('X-Forwarded-For', ip)
        .send({ authorName: 'G', content: 'again' })
        .expect(429);
    });
  });

  describe('uploads', () => {
    it('stores real images under a random name', async () => {
      const { token } = await login();
      const res = await api()
        .post('/api/admin/uploads')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', PNG, {
          filename: 'photo.png',
          contentType: 'image/png',
        })
        .expect(201);
      expect(res.body.url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/);
      await api()
        .get(res.body.url)
        .expect(200)
        .expect('Content-Type', /image\/png/);
    });

    it('rejects a non-image renamed to .png', async () => {
      const { token } = await login();
      await api()
        .post('/api/admin/uploads')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from('#!/bin/sh\nrm -rf /'), {
          filename: 'evil.png',
          contentType: 'image/png',
        })
        .expect(400);
    });
  });
});
