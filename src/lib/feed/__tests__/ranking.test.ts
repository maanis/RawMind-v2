import { applyFreshnessMix, scoreVideo } from "@/lib/feed/ranking";
import { StoredVideo, UserProfile } from "@/lib/feed/types";

function makeVideo(overrides: Partial<StoredVideo>): StoredVideo {
  const now = new Date().toISOString();
  return {
    sessionId: "s1",
    deviceId: "d1",
    videoId: "v1",
    title: "Title",
    channelTitle: "Channel",
    description: "",
    thumbnailUrl: "",
    sourceQueries: ["q1"],
    topicTags: ["ai"],
    sourceRank: 0,
    baseScore: 0.5,
    served: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const profile: UserProfile = {
  deviceId: "d1",
  topicAffinities: { ai: 1 },
  channelAffinities: { channel: 1 },
  seenVideoIds: [],
  totalLikes: 0,
  totalSignals: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("ranking", () => {
  it("scoreVideo rewards affinity and freshness", () => {
    const fresh = makeVideo({ videoId: "fresh", publishedAt: new Date().toISOString(), baseScore: 0.4 });
    const stale = makeVideo({ videoId: "stale", publishedAt: "2018-01-01T00:00:00.000Z", baseScore: 0.4 });

    expect(scoreVideo(fresh, new Set(), profile)).toBeGreaterThan(scoreVideo(stale, new Set(), profile));
  });

  it("applyFreshnessMix returns unique items", () => {
    const videos = [
      makeVideo({ videoId: "a", baseScore: 0.9 }),
      makeVideo({ videoId: "b", baseScore: 0.8 }),
      makeVideo({ videoId: "a", baseScore: 0.7 }),
    ];

    const mixed = applyFreshnessMix(videos);
    const ids = mixed.map((v) => v.videoId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
