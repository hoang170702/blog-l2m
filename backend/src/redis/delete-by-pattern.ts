import type { Redis } from 'ioredis';

/** Deletes every key matching a glob pattern using SCAN, without blocking Redis. */
export async function deleteByPattern(redis: Redis, pattern: string) {
  const stream = redis.scanStream({ match: pattern, count: 200 });
  for await (const keys of stream) {
    if ((keys as string[]).length > 0) {
      await redis.unlink(...(keys as string[]));
    }
  }
}
