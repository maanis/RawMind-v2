import { getCollection } from "@/lib/db/mongodb";
import { acquireVideosForSession } from "@/lib/feed/youtube";
import { StoredVideo } from "@/lib/feed/types";
import { log } from "@/lib/logger";

export const POOL_TOPICS = [
  "startup founders",
  "learn programming",
  "AI and machine learning",
  "product design",
  "personal finance",
  "science explained",
  "history stories",
  "motivation",
  "cooking tutorials",
  "fitness and health",
];

const POOL_SESSION = "pool-global";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const PRUNE_SCORE_THRESHOLD = 0.2;

export async function refreshPools() {
  const col = await getCollection<StoredVideo>("videos");
  if (!col) {
    return { ok: false, reason: "mongodb_unavailable" as const };
  }

  let fetched = 0;
  let upserted = 0;
  let updated = 0;
  const failures: Array<{ topic: string; error: string }> = [];

  for (const topic of POOL_TOPICS) {
    try {
      const videos = await acquireVideosForSession({
        sessionId: POOL_SESSION,
        deviceId: "cron",
        queries: [topic],
      });
      fetched += videos.length;

      const now = new Date().toISOString();
      const ops = videos.map((video) => ({
        updateOne: {
          filter: { sessionId: POOL_SESSION, videoId: video.videoId },
          update: {
            $set: {
              ...video,
              sessionId: POOL_SESSION,
              topicTags: Array.from(new Set([...video.topicTags, topic])),
              updatedAt: now,
            },
            $setOnInsert: {
              served: false,
              createdAt: now,
            },
          },
          upsert: true,
        },
      }));

      if (ops.length > 0) {
        const result = await col.bulkWrite(ops, { ordered: false });
        upserted += result.upsertedCount;
        updated += result.modifiedCount;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      failures.push({ topic, error: message });
      log("warn", "refresh_pool_topic_failed", { topic, error: message });
    }
  }

  const cutoffIso = new Date(Date.now() - MAX_AGE_MS).toISOString();
  const pruneResult = await col.deleteMany({
    sessionId: POOL_SESSION,
    createdAt: { $lt: cutoffIso },
    baseScore: { $lt: PRUNE_SCORE_THRESHOLD },
  });

  log("info", "refresh_pools_completed", {
    topics: POOL_TOPICS.length,
    fetched,
    upserted,
    updated,
    pruned: pruneResult.deletedCount ?? 0,
    failedTopics: failures.length,
  });

  return {
    ok: true,
    topics: POOL_TOPICS.length,
    fetched,
    upserted,
    updated,
    pruned: pruneResult.deletedCount ?? 0,
    failures,
  };
}
