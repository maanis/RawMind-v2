import { Redis } from "@upstash/redis";

let redisClient: Redis | null = null;

function getRedisClient() {
  if (redisClient) return redisClient;

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;

  redisClient = new Redis({ url, token });
  return redisClient;
}

export async function redisIncrWithWindow(key: string, windowSeconds: number): Promise<number | null> {
  try {
    const client = getRedisClient();
    if (!client) return null;
    const count = await client.incr(key);
    if (count === 1) {
      await client.expire(key, windowSeconds);
    }
    return count;
  } catch {
    return null;
  }
}

export async function redisGetJson<T>(key: string): Promise<T | null> {
  try {
    const client = getRedisClient();
    if (!client) return null;
    return (await client.get<T>(key)) ?? null;
  } catch {
    return null;
  }
}

export async function redisSetJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    const client = getRedisClient();
    if (!client) return;
    await client.set(key, value, { ex: ttlSeconds });
  } catch {
    // Silent fallback to in-memory caches.
  }
}
