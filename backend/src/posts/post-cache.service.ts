import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Redis } from 'ioredis';
import { REDIS } from '../redis/redis.module.js';

const PREFIX = 'cache:posts:';
export const LIST_TTL_SECONDS = 60;
export const DETAIL_TTL_SECONDS = 300;

/** Read-through cache for public post queries. Any content write clears all post entries. */
@Injectable()
export class PostCacheService {
  private readonly logger = new Logger(PostCacheService.name);

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  listKey(query: object) {
    const hash = createHash('sha1').update(JSON.stringify(query)).digest('hex');
    return `${PREFIX}list:${hash}`;
  }

  detailKey(slug: string) {
    return `${PREFIX}slug:${slug}`;
  }

  async getOrLoad<T>(
    key: string,
    ttlSeconds: number,
    load: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.redis.get(key).catch((error: unknown) => {
      // A cache outage must not take public pages down.
      this.logger.warn(`cache read failed: ${String(error)}`);
      return null;
    });
    if (cached !== null) {
      return JSON.parse(cached) as T;
    }
    const value = await load();
    if (value !== null && value !== undefined) {
      await this.redis
        .set(key, JSON.stringify(value), 'EX', ttlSeconds)
        .catch((error: unknown) =>
          this.logger.warn(`cache write failed: ${String(error)}`),
        );
    }
    return value;
  }

  async invalidateAll() {
    const stream = this.redis.scanStream({ match: `${PREFIX}*`, count: 200 });
    for await (const keys of stream) {
      if ((keys as string[]).length > 0) {
        await this.redis.unlink(...(keys as string[]));
      }
    }
  }
}
