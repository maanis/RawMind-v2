import { StoredVideo } from "@/lib/feed/types";
import { log } from "@/lib/logger";
import { redisGetJson, redisSetJson } from "@/lib/cache/redis";

interface YouTubeSearchResult {
  id: {
    videoId?: string;
  };
  snippet: {
    title: string;
    channelTitle: string;
    description: string;
    publishedAt?: string;
    thumbnails?: {
      high?: { url: string };
      medium?: { url: string };
      default?: { url: string };
    };
  };
}

const FALLBACK_VIDEOS = [
  { id: "jNQXAC9IVRw", title: "Me at the zoo", channelTitle: "jawed" },
  { id: "dQw4w9WgXcQ", title: "Never Gonna Give You Up", channelTitle: "Rick Astley" },
  { id: "M7lc1UVf-VE", title: "YouTube Developers Live", channelTitle: "Google for Developers" },
  { id: "ysz5S6PUM-U", title: "Big Buck Bunny Trailer", channelTitle: "Blender Foundation" },
];

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
}

export async function acquireVideosForSession(input: {
  sessionId: string;
  deviceId: string;
  queries: string[];
  excludeIds?: Set<string>;
}) {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim().replace(/^["']|["']$/g, "");
  const sessionNow = new Date().toISOString();
  const deduped = new Map<string, StoredVideo>();
  const queries = input.queries.slice(0, 5);
  const perQueryResults = queries.length >= 4 ? 20 : 25;

  if (!apiKey) {
    log("warn", "youtube_api_key_missing_fallback", { queryCount: queries.length });
    return FALLBACK_VIDEOS.map((video, index) => ({
      sessionId: input.sessionId,
      deviceId: input.deviceId,
      videoId: video.id,
      title: video.title,
      channelTitle: video.channelTitle,
      description: "",
      thumbnailUrl: "",
      sourceQueries: [queries[0] ?? "general"],
      topicTags: tokenize(`${queries.join(" ")} ${video.title}`),
      sourceRank: index,
      baseScore: Number((1 - index * 0.08).toFixed(4)),
      served: false,
      createdAt: sessionNow,
      updatedAt: sessionNow,
    }));
  }

  const settled = await Promise.allSettled(
    queries.map(async (query) => {
      const cacheKey = `yt:${query.toLowerCase().trim()}`;
      const cachedItems = await redisGetJson<YouTubeSearchResult[]>(cacheKey);
      if (cachedItems) {
        log("info", "youtube_cache_hit", { query, resultCount: cachedItems.length });
        return { query, items: cachedItems };
      }

      log("info", "youtube_search_started", { query, maxResults: perQueryResults });
      const url = new URL("https://www.googleapis.com/youtube/v3/search");
      url.searchParams.set("part", "snippet");
      url.searchParams.set("maxResults", String(perQueryResults));
      url.searchParams.set("q", query);
      url.searchParams.set("type", "video");
      url.searchParams.set("videoEmbeddable", "true");
      url.searchParams.set("safeSearch", "moderate");
      url.searchParams.set("key", apiKey);

      const response = await fetch(url.toString(), { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`YouTube search failed with ${response.status}`);
      }

      const data = await response.json();
      await redisSetJson(cacheKey, (data.items ?? []) as YouTubeSearchResult[], 1800);
      log("info", "youtube_search_succeeded", { query, resultCount: (data.items ?? []).length });
      return {
        query,
        items: (data.items ?? []) as YouTubeSearchResult[],
      };
    })
  );

  settled.forEach((result) => {
    if (result.status !== "fulfilled") {
      log("error", "youtube_search_failed", {
        error: result.reason instanceof Error ? result.reason.message : "unknown",
      });
      return;
    }

    result.value.items.forEach((item, index) => {
      const videoId = item.id.videoId;
      if (!videoId) return;
      if (input.excludeIds?.has(videoId)) return;

      const existing = deduped.get(videoId);
      if (existing) {
        if (!existing.sourceQueries.includes(result.value.query)) {
          existing.sourceQueries.push(result.value.query);
        }
        existing.sourceRank = Math.min(existing.sourceRank, index);
        existing.baseScore = Math.max(existing.baseScore, Number((1 - index / perQueryResults).toFixed(4)));
        existing.updatedAt = sessionNow;
        existing.topicTags = Array.from(
          new Set([...existing.topicTags, ...tokenize(`${result.value.query} ${item.snippet.title}`)])
        );
        return;
      }

      const thumbnailUrl =
        item.snippet.thumbnails?.high?.url ??
        item.snippet.thumbnails?.medium?.url ??
        item.snippet.thumbnails?.default?.url ??
        "";

      deduped.set(videoId, {
        sessionId: input.sessionId,
        deviceId: input.deviceId,
        videoId,
        title: item.snippet.title,
        channelTitle: item.snippet.channelTitle,
        description: item.snippet.description ?? "",
        thumbnailUrl,
        publishedAt: item.snippet.publishedAt,
        sourceQueries: [result.value.query],
        topicTags: tokenize(`${result.value.query} ${item.snippet.title}`),
        sourceRank: index,
        baseScore: Number((1 - index / perQueryResults).toFixed(4)),
        served: false,
        createdAt: sessionNow,
        updatedAt: sessionNow,
      });
    });
  });

  return [...deduped.values()];
}
