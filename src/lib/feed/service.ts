import { TTLCache } from "@/lib/cache/ttl-cache";
import { generateQueryPlan } from "@/lib/ai/gemini";
import {
  createSession,
  findReusableSession,
  getOrCreateProfile,
  getRecentSignals,
  getSession,
  getSessionVideo,
  insertSessionVideos,
  listSessionVideoIds,
  listUnreadVideos,
  markVideosServed,
  recordSignal,
  saveProfile,
  updateSession,
} from "@/lib/feed/store";
import {
  FeedPage,
  FeedSession,
  FeedSignal,
  FeedVideo,
  StoredVideo,
  UserProfile,
} from "@/lib/feed/types";
import { rankUnreadVideos, scoreVideo } from "@/lib/feed/ranking";
import { acquireVideosForSession } from "@/lib/feed/youtube";
import { log } from "@/lib/logger";
import { redisGetJson, redisSetJson } from "@/lib/cache/redis";

const SESSION_CACHE = new TTLCache<FeedSession>(1000 * 60 * 5);
const PROFILE_CACHE = new TTLCache<UserProfile>(1000 * 60 * 10);
const PAGE_SIZE = 10;
const REFILL_THRESHOLD = 8;

function nowIso() {
  return new Date().toISOString();
}

function normalizePrompt(prompt: string) {
  return prompt.trim().toLowerCase().replace(/\s+/g, " ");
}

function getProfileCacheKey(deviceId: string) {
  return `profile:${deviceId}`;
}

function getSessionCacheKey(sessionId: string) {
  return `session:${sessionId}`;
}

function getSessionRedisKey(sessionId: string) {
  return `session:${sessionId}`;
}

async function loadProfile(deviceId: string) {
  const redisKey = `profile:${deviceId}`;
  const redisProfile = await redisGetJson<UserProfile>(redisKey);
  if (redisProfile) {
    if (!Array.isArray(redisProfile.seenVideoIds)) redisProfile.seenVideoIds = [];
    PROFILE_CACHE.set(getProfileCacheKey(deviceId), redisProfile);
    return redisProfile;
  }

  const cached = PROFILE_CACHE.get(getProfileCacheKey(deviceId));
  if (cached) {
    if (!Array.isArray(cached.seenVideoIds)) cached.seenVideoIds = [];
    return cached;
  }

  const profile = await getOrCreateProfile(deviceId);
  if (!Array.isArray(profile.seenVideoIds)) profile.seenVideoIds = [];
  PROFILE_CACHE.set(getProfileCacheKey(deviceId), profile);
  await redisSetJson(redisKey, profile, 300);
  return profile;
}

async function loadSession(sessionId: string) {
  const redisKey = getSessionRedisKey(sessionId);
  const redisSession = await redisGetJson<FeedSession>(redisKey);
  if (redisSession) {
    SESSION_CACHE.set(getSessionCacheKey(sessionId), redisSession);
    return redisSession;
  }

  const cached = SESSION_CACHE.get(getSessionCacheKey(sessionId));
  if (cached) return cached;

  const session = await getSession(sessionId);
  if (session) {
    SESSION_CACHE.set(getSessionCacheKey(sessionId), session);
    await redisSetJson(redisKey, session, 300);
  }
  return session;
}

function explainVideo(video: StoredVideo, profile: UserProfile) {
  const strongestTopic =
    video.topicTags
      .map((topic) => ({ topic, affinity: profile.topicAffinities[topic] ?? 0 }))
      .sort((left, right) => right.affinity - left.affinity)[0]?.topic ??
    video.sourceQueries[0] ??
    "your intent";

  return `Picked for ${strongestTopic} and ${video.channelTitle}`;
}

function toFeedVideo(video: StoredVideo, session: FeedSession, profile: UserProfile): FeedVideo {
  return {
    id: video.videoId,
    title: video.title,
    channelTitle: video.channelTitle,
    reason: explainVideo(video, profile),
    originalQuery: session.prompt,
    thumbnailUrl: video.thumbnailUrl,
    relevanceScore: scoreVideo(video, new Set(session.recentServedChannels), profile),
  };
}

function selectRefillQueries(session: FeedSession, profile: UserProfile) {
  const preferredTopics = Object.entries(profile.topicAffinities)
    .filter(([, weight]) => weight > 0)
    .sort((left, right) => right[1] - left[1])
    .map(([topic]) => topic)
    .slice(0, 3);

  const enriched = [...session.queryPlan.searchQueries];
  if (preferredTopics.length > 0) {
    enriched.unshift(`${session.queryPlan.normalizedIntent} ${preferredTopics.join(" ")}`);
  }

  return Array.from(new Set(enriched)).slice(0, 5);
}

async function acquireAndStoreVideos(session: FeedSession, profile: UserProfile, excludeIds?: Set<string>) {
  log("info", "youtube_acquire_started", {
    sessionId: session.sessionId,
    queryCount: session.queryPlan.searchQueries.length,
    refill: Boolean(excludeIds),
  });
  const candidateVideos = await acquireVideosForSession({
    sessionId: session.sessionId,
    deviceId: session.deviceId,
    queries: excludeIds ? selectRefillQueries(session, profile) : session.queryPlan.searchQueries,
    excludeIds,
  });

  const inserted = await insertSessionVideos(candidateVideos);
  log("info", "youtube_acquire_completed", {
    sessionId: session.sessionId,
    fetched: candidateVideos.length,
    inserted,
  });
  if (inserted === 0) {
    const updated = await updateSession(session.sessionId, {
      depleted: true,
      refillInProgress: false,
    });
    if (updated) {
      SESSION_CACHE.set(getSessionCacheKey(updated.sessionId), updated);
      await redisSetJson(getSessionRedisKey(updated.sessionId), updated, 300);
    }
    return updated ?? session;
  }

  const updated = await updateSession(session.sessionId, {
    totalVideos: session.totalVideos + inserted,
    remainingCount: session.remainingCount + inserted,
    refillInProgress: false,
    depleted: false,
    refillCount: excludeIds ? session.refillCount + 1 : session.refillCount,
  });

  if (updated) {
    SESSION_CACHE.set(getSessionCacheKey(updated.sessionId), updated);
    await redisSetJson(getSessionRedisKey(updated.sessionId), updated, 300);
  }
  return updated ?? session;
}

async function maybeRefillSession(session: FeedSession, profile: UserProfile, force = false) {
  if (session.refillInProgress) return session;
  if (!force && (session.remainingCount > REFILL_THRESHOLD || session.depleted)) return session;

  const locked = await updateSession(session.sessionId, { refillInProgress: true });
  if (!locked) return session;

  SESSION_CACHE.set(getSessionCacheKey(locked.sessionId), locked);
  const excludeIds = await listSessionVideoIds(session.sessionId);
  return acquireAndStoreVideos(locked, profile, excludeIds);
}

async function serveNextPage(session: FeedSession, profile: UserProfile): Promise<FeedPage> {
  let workingSession = session;
  let unreadVideos = await listUnreadVideos(session.sessionId);
  const seenIds = new Set(profile.seenVideoIds ?? []);
  unreadVideos = unreadVideos.filter((video) => !seenIds.has(video.videoId));

  if (unreadVideos.length === 0 && !session.depleted) {
    workingSession = await maybeRefillSession(session, profile, true);
    unreadVideos = await listUnreadVideos(workingSession.sessionId);
    unreadVideos = unreadVideos.filter((video) => !seenIds.has(video.videoId));
  }

  const ranked = rankUnreadVideos(unreadVideos, workingSession, profile);
  const page = ranked.slice(0, PAGE_SIZE);
  const servedIds = page.map((video) => video.videoId);

  await markVideosServed(workingSession.sessionId, servedIds);
  profile.seenVideoIds = [...(profile.seenVideoIds ?? []), ...servedIds].slice(-200);
  await saveProfile(profile);
  PROFILE_CACHE.set(getProfileCacheKey(profile.deviceId), profile);
  await redisSetJson(`profile:${profile.deviceId}`, profile, 300);

  const recentChannels = Array.from(
    new Set([...page.map((video) => video.channelTitle), ...workingSession.recentServedChannels])
  ).slice(0, 10);

  const updatedSession = await updateSession(workingSession.sessionId, {
    remainingCount: Math.max(workingSession.remainingCount - servedIds.length, 0),
    recentServedChannels: recentChannels,
  });

  const finalSession = updatedSession ?? workingSession;
  SESSION_CACHE.set(getSessionCacheKey(finalSession.sessionId), finalSession);
  await redisSetJson(getSessionRedisKey(finalSession.sessionId), finalSession, 300);

  if (finalSession.remainingCount <= REFILL_THRESHOLD && !finalSession.refillInProgress && !finalSession.depleted) {
    void maybeRefillSession(finalSession, profile).catch((error) => {
      console.error("Background refill failed:", error);
    });
  }

  return {
    sessionId: finalSession.sessionId,
    intentProfile: finalSession.queryPlan.intentProfile,
    videos: page.map((video) => toFeedVideo(video, finalSession, profile)),
    profile,
    remainingCount: finalSession.remainingCount,
    hasMore: finalSession.remainingCount > 0 || !finalSession.depleted,
    refilling: finalSession.refillInProgress || finalSession.remainingCount <= REFILL_THRESHOLD,
  };
}

export async function startFeedSession(prompt: string, deviceId: string) {
  log("info", "feed_session_start_requested", { deviceId });
  const normalizedPrompt = normalizePrompt(prompt);
  const profile = await loadProfile(deviceId);
  const reusable = await findReusableSession(deviceId, normalizedPrompt);

  if (reusable) {
    log("info", "feed_session_reused", { deviceId, sessionId: reusable.sessionId });
    SESSION_CACHE.set(getSessionCacheKey(reusable.sessionId), reusable);
    await redisSetJson(getSessionRedisKey(reusable.sessionId), reusable, 300);
    return serveNextPage(reusable, profile);
  }

  const recentSignals = await getRecentSignals(deviceId, 10);
  log("info", "gemini_plan_requested", { deviceId, promptLength: prompt.length, signals: recentSignals.length });
  const queryPlan = await generateQueryPlan(prompt, profile, recentSignals);
  log("info", "gemini_plan_completed", { deviceId, queries: queryPlan.searchQueries.length });
  const session: FeedSession = {
    sessionId: crypto.randomUUID(),
    deviceId,
    prompt,
    promptSignature: normalizedPrompt,
    queryPlan,
    remainingCount: 0,
    totalVideos: 0,
    depleted: false,
    refillCount: 0,
    refillInProgress: false,
    recentServedChannels: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  await createSession(session);
  log("info", "feed_session_created", { deviceId, sessionId: session.sessionId });
  SESSION_CACHE.set(getSessionCacheKey(session.sessionId), session);
  await redisSetJson(getSessionRedisKey(session.sessionId), session, 300);

  const populatedSession = await acquireAndStoreVideos(session, profile);
  return serveNextPage(populatedSession, profile);
}

export async function getNextFeedPage(sessionId: string, deviceId: string) {
  log("info", "feed_next_requested", { sessionId, deviceId });
  const session = await loadSession(sessionId);
  if (!session || session.deviceId !== deviceId) {
    throw new Error("Feed session not found");
  }

  const profile = await loadProfile(deviceId);
  return serveNextPage(session, profile);
}

export async function recordFeedSignal(signal: FeedSignal) {
  log("info", "signal_record_attempt", {
    sessionId: signal.sessionId,
    deviceId: signal.deviceId,
    videoId: signal.videoId,
    type: signal.type,
  });
  await recordSignal(signal);

  const profile = await loadProfile(signal.deviceId);
  const session = await loadSession(signal.sessionId);
  if (!session) return { ok: true, profile };

  const video = await getSessionVideo(signal.sessionId, signal.videoId);
  if (!video) return { ok: true, profile };

  profile.totalSignals += 1;

  const videoTopics = video.topicTags.length > 0 ? video.topicTags : session.queryPlan.intentProfile.topics;
  const topicDelta =
    signal.type === "like"
      ? signal.value === true
        ? 1
        : -0.5
      : typeof signal.value === "number"
        ? signal.value >= 12
          ? 0.4
          : -0.35
        : 0;

  videoTopics.forEach((topic) => {
    profile.topicAffinities[topic] = Number(((profile.topicAffinities[topic] ?? 0) + topicDelta).toFixed(4));
  });

  const channelKey = video.channelTitle.toLowerCase();
  profile.channelAffinities[channelKey] = Number(
    (((profile.channelAffinities[channelKey] ?? 0) + topicDelta)).toFixed(4)
  );

  if (signal.type === "like" && signal.value === true) {
    profile.totalLikes += 1;
  }

  await saveProfile(profile);
  PROFILE_CACHE.set(getProfileCacheKey(signal.deviceId), profile);
  await redisSetJson(`profile:${signal.deviceId}`, profile, 300);
  return { ok: true, profile };
}
