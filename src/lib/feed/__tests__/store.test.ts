import { jest } from "@jest/globals";

const getCollectionMock: jest.Mock = jest.fn();

jest.mock("@/lib/db/mongodb", () => ({
  getCollection: (...args: unknown[]) => getCollectionMock(...args),
}));

describe("store.insertSessionVideos", () => {
  it("uses bulkWrite with upsert operations", async () => {
    const bulkWrite: jest.Mock = jest.fn().mockImplementation(async () => ({ upsertedCount: 2 } as const));
    getCollectionMock.mockImplementation(async () => ({ bulkWrite }));

    const { insertSessionVideos } = await import("@/lib/feed/store");

    const inserted = await insertSessionVideos([
      {
        sessionId: "s1",
        deviceId: "d1",
        videoId: "v1",
        title: "a",
        channelTitle: "c",
        description: "",
        thumbnailUrl: "",
        sourceQueries: ["q"],
        topicTags: ["t"],
        sourceRank: 0,
        baseScore: 0.9,
        served: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        sessionId: "s1",
        deviceId: "d1",
        videoId: "v2",
        title: "b",
        channelTitle: "c",
        description: "",
        thumbnailUrl: "",
        sourceQueries: ["q"],
        topicTags: ["t"],
        sourceRank: 1,
        baseScore: 0.8,
        served: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    expect(inserted).toBe(2);
    expect(bulkWrite).toHaveBeenCalledTimes(1);
    const [ops, options] = bulkWrite.mock.calls[0];
    expect(Array.isArray(ops)).toBe(true);
    expect(ops).toHaveLength(2);
    expect(options).toEqual({ ordered: false });
  });
});
