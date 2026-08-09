import { redisIncrWithWindow } from "@/lib/cache/redis";

const windows = new Map<string, number[]>();

function checkRateLimitInMemory(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = (windows.get(key) ?? []).filter((ts) => now - ts < windowMs);

  if (timestamps.length >= limit) {
    windows.set(key, timestamps);
    return false;
  }

  timestamps.push(now);
  windows.set(key, timestamps);
  return true;
}

export async function checkRateLimit(key: string, limit = 30, windowMs = 60_000): Promise<boolean> {
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  const redisCount = await redisIncrWithWindow(`rate:${key}`, windowSeconds);
  if (typeof redisCount === "number") {
    return redisCount <= limit;
  }
  return checkRateLimitInMemory(key, limit, windowMs);
}
