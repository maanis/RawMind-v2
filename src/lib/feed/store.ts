import { getCollection } from "@/lib/db/mongodb";
import { FeedSession, FeedSignal, StoredVideo, UserProfile } from "@/lib/feed/types";

type SessionPatch = Partial<FeedSession>;

const nowIso = () => new Date().toISOString();

const memory = {
  profiles: new Map<string, UserProfile>(),
  sessions: new Map<string, FeedSession>(),
  videos: new Map<string, StoredVideo[]>(),
  signals: [] as FeedSignal[],
};

export async function getOrCreateProfile(deviceId: string) {
  const profiles = await getCollection<UserProfile>("profiles");
  if (!profiles) {
    const existing = memory.profiles.get(deviceId);
    if (existing) return existing;

    const created: UserProfile = {
      deviceId,
      topicAffinities: {},
      channelAffinities: {},
      seenVideoIds: [],
      totalLikes: 0,
      totalSignals: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    memory.profiles.set(deviceId, created);
    return created;
  }

  const existing = await profiles.findOne({ deviceId });
  if (existing) return existing;

  const created: UserProfile = {
    deviceId,
    topicAffinities: {},
    channelAffinities: {},
    seenVideoIds: [],
    totalLikes: 0,
    totalSignals: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await profiles.insertOne(created);
  return created;
}

export async function saveProfile(profile: UserProfile) {
  const profiles = await getCollection<UserProfile>("profiles");
  profile.updatedAt = nowIso();

  if (!profiles) {
    memory.profiles.set(profile.deviceId, profile);
    return profile;
  }

  await profiles.updateOne({ deviceId: profile.deviceId }, { $set: profile }, { upsert: true });
  return profile;
}

export async function getRecentSignals(deviceId: string, limit = 10) {
  const signals = await getCollection<FeedSignal>("signals");
  if (!signals) {
    return memory.signals
      .filter((signal) => signal.deviceId === deviceId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  return signals.find({ deviceId }).sort({ timestamp: -1 }).limit(limit).toArray();
}

export async function findReusableSession(deviceId: string, promptSignature: string) {
  const feedSessions = await getCollection<FeedSession>("feed_sessions");
  if (!feedSessions) {
    return [...memory.sessions.values()]
      .filter(
        (session) =>
          session.deviceId === deviceId &&
          session.promptSignature === promptSignature &&
          session.remainingCount > 0
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
  }

  return feedSessions.findOne(
    { deviceId, promptSignature, remainingCount: { $gt: 0 } },
    { sort: { updatedAt: -1 } }
  );
}

export async function createSession(session: FeedSession) {
  const feedSessions = await getCollection<FeedSession>("feed_sessions");
  if (!feedSessions) {
    memory.sessions.set(session.sessionId, session);
    return session;
  }

  await feedSessions.insertOne(session);
  return session;
}

export async function getSession(sessionId: string) {
  const feedSessions = await getCollection<FeedSession>("feed_sessions");
  if (!feedSessions) {
    return memory.sessions.get(sessionId) ?? null;
  }

  return feedSessions.findOne({ sessionId });
}

export async function updateSession(sessionId: string, patch: SessionPatch) {
  const existing = await getSession(sessionId);
  if (!existing) return null;

  const updated: FeedSession = {
    ...existing,
    ...patch,
    updatedAt: nowIso(),
  };

  const feedSessions = await getCollection<FeedSession>("feed_sessions");
  if (!feedSessions) {
    memory.sessions.set(sessionId, updated);
    return updated;
  }

  await feedSessions.updateOne({ sessionId }, { $set: updated });
  return updated;
}

export async function insertSessionVideos(videos: StoredVideo[]) {
  if (videos.length === 0) return 0;

  const collection = await getCollection<StoredVideo>("videos");
  if (!collection) {
    const sessionVideos = memory.videos.get(videos[0].sessionId) ?? [];
    const existingIds = new Set(sessionVideos.map((video) => video.videoId));
    const fresh = videos.filter((video) => !existingIds.has(video.videoId));
    memory.videos.set(videos[0].sessionId, [...sessionVideos, ...fresh]);
    return fresh.length;
  }

  const result = await collection.bulkWrite(
    videos.map((video) => ({
      updateOne: {
        filter: { sessionId: video.sessionId, videoId: video.videoId },
        update: { $setOnInsert: video },
        upsert: true,
      },
    })),
    { ordered: false }
  );

  return result.upsertedCount;
}

export async function getSessionVideo(sessionId: string, videoId: string) {
  const collection = await getCollection<StoredVideo>("videos");
  if (!collection) {
    return (memory.videos.get(sessionId) ?? []).find((video) => video.videoId === videoId) ?? null;
  }

  return collection.findOne({ sessionId, videoId });
}

export async function listUnreadVideos(sessionId: string) {
  const collection = await getCollection<StoredVideo>("videos");
  if (!collection) {
    return (memory.videos.get(sessionId) ?? []).filter((video) => !video.served);
  }

  return collection.find({ sessionId, served: false }).toArray();
}

export async function listSessionVideoIds(sessionId: string) {
  const collection = await getCollection<StoredVideo>("videos");
  if (!collection) {
    return new Set((memory.videos.get(sessionId) ?? []).map((video) => video.videoId));
  }

  const videos = await collection.find({ sessionId }, { projection: { videoId: 1 } }).toArray();
  return new Set(videos.map((video) => video.videoId));
}

export async function markVideosServed(sessionId: string, videoIds: string[]) {
  if (videoIds.length === 0) return;

  const collection = await getCollection<StoredVideo>("videos");
  if (!collection) {
    const updated = (memory.videos.get(sessionId) ?? []).map((video) =>
      videoIds.includes(video.videoId)
        ? { ...video, served: true, servedAt: nowIso(), updatedAt: nowIso() }
        : video
    );
    memory.videos.set(sessionId, updated);
    return;
  }

  await collection.updateMany(
    { sessionId, videoId: { $in: videoIds } },
    { $set: { served: true, servedAt: nowIso(), updatedAt: nowIso() } }
  );
}

export async function recordSignal(signal: FeedSignal) {
  const collection = await getCollection<FeedSignal>("signals");
  if (!collection) {
    memory.signals.push(signal);
    return;
  }

  await collection.insertOne(signal);
}
