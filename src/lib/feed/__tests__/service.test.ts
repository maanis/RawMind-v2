import { jest } from "@jest/globals";
import type { FeedSession, StoredVideo, UserProfile } from "@/lib/feed/types";

const store = {
  profile: null as UserProfile | null,
  session: null as FeedSession | null,
  unreadVideos: [] as StoredVideo[],
  markedServedIds: [] as string[],
};

jest.mock("@/lib/ai/gemini", () => ({
  generateQueryPlan: jest.fn(async () => ({
    normalizedIntent: "learn ai",
    searchQueries: ["learn ai"],
    intentProfile: {
      topics: ["ai"],
      goal_mix: { learning: 0.8, entertainment: 0.2 },
      tone: "balanced",
      energy: "medium",
      strictness: 0.6,
    },
  })),
}));

jest.mock("@/lib/feed/youtube", () => ({
  acquireVideosForSession: jest.fn(async () => []),
}));

jest.mock("@/lib/feed/ranking", () => ({
  rankUnreadVideos: jest.fn((videos: StoredVideo[]) => videos),
  scoreVideo: jest.fn(() => 0.5),
}));

jest.mock("@/lib/cache/redis", () => ({
  redisGetJson: jest.fn(async () => null),
  redisSetJson: jest.fn(async () => undefined),
}));

jest.mock("@/lib/logger", () => ({
  log: jest.fn(),
}));

jest.mock("@/lib/feed/store", () => ({
  getOrCreateProfile: jest.fn(async () => {
    if (!store.profile) {
      store.profile = {
        deviceId: "d1",
        topicAffinities: {},
        channelAffinities: {},
        seenVideoIds: [],
        totalLikes: 0,
        totalSignals: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    return store.profile;
  }),
  saveProfile: jest.fn(async (profile: UserProfile) => {
    store.profile = profile;
    return profile;
  }),
  getRecentSignals: jest.fn(async () => []),
  findReusableSession: jest.fn(async () => null),
  createSession: jest.fn(async (session: FeedSession) => {
    store.session = session;
    return session;
  }),
  getSession: jest.fn(async (sessionId: string) => {
    if (store.session?.sessionId === sessionId) return store.session;
    return null;
  }),
  updateSession: jest.fn(async (_sessionId: string, patch: Partial<FeedSession>) => {
    if (!store.session) return null;
    store.session = { ...store.session, ...patch, updatedAt: new Date().toISOString() };
    return store.session;
  }),
  insertSessionVideos: jest.fn(async () => 0),
  listUnreadVideos: jest.fn(async () => store.unreadVideos),
  markVideosServed: jest.fn(async (_sessionId: string, videoIds: string[]) => {
    store.markedServedIds = videoIds;
    store.unreadVideos = store.unreadVideos.map((video) =>
      videoIds.includes(video.videoId) ? { ...video, served: true } : video
    );
  }),
  listSessionVideoIds: jest.fn(async () => new Set<string>()),
  recordSignal: jest.fn(async () => undefined),
  getSessionVideo: jest.fn(async () => null),
}));

function makeSession(overrides: Partial<FeedSession> = {}): FeedSession {
  return {
    sessionId: "s1",
    deviceId: "d1",
    prompt: "learn ai",
    promptSignature: "learn ai",
    queryPlan: {
      normalizedIntent: "learn ai",
      searchQueries: ["learn ai"],
      intentProfile: {
        topics: ["ai"],
        goal_mix: { learning: 0.8, entertainment: 0.2 },
        tone: "balanced",
        energy: "medium",
        strictness: 0.6,
      },
    },
    remainingCount: 2,
    totalVideos: 2,
    depleted: false,
    refillCount: 0,
    refillInProgress: false,
    recentServedChannels: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeVideo(videoId: string, sessionId = "s1"): StoredVideo {
  const now = new Date().toISOString();
  return {
    sessionId,
    deviceId: "d1",
    videoId,
    title: `video-${videoId}`,
    channelTitle: "channel-a",
    description: "",
    thumbnailUrl: "",
    publishedAt: now,
    sourceQueries: ["learn ai"],
    topicTags: ["ai"],
    sourceRank: 0,
    baseScore: 0.5,
    served: false,
    createdAt: now,
    updatedAt: now,
  };
}

describe("feed service", () => {
  beforeEach(() => {
    store.profile = {
      deviceId: "d1",
      topicAffinities: {},
      channelAffinities: {},
      seenVideoIds: [],
      totalLikes: 0,
      totalSignals: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.session = makeSession();
    store.unreadVideos = [makeVideo("v1"), makeVideo("v2")];
    store.markedServedIds = [];
  });

  it("filters seen videos and appends new served ids", async () => {
    store.profile!.seenVideoIds = ["v1"];

    const { getNextFeedPage } = await import("@/lib/feed/service");
    const page = await getNextFeedPage("s1", "d1");

    expect(page.videos.map((video) => video.id)).toEqual(["v2"]);
    expect(store.markedServedIds).toEqual(["v2"]);
    expect(page.profile?.seenVideoIds).toEqual(["v1", "v2"]);
  });

  it("returns remaining count based on served page size", async () => {
    store.session = makeSession({ sessionId: "s2", remainingCount: 2, totalVideos: 2 });
    store.unreadVideos = [makeVideo("v10", "s2"), makeVideo("v11", "s2")];

    const { getNextFeedPage } = await import("@/lib/feed/service");
    const page = await getNextFeedPage("s2", "d1");

    expect(page.remainingCount).toBe(0);
    expect(page.hasMore).toBe(true);
    expect(page.videos).toHaveLength(2);
  });
});
