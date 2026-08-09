import { parseErrorPayload, parseFeedPagePayload, parseSignalPayload } from "@/lib/feed/contracts";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("feed contracts", () => {
  it("parses valid feed page payload", async () => {
    const response = jsonResponse({
      sessionId: "s1",
      intentProfile: {
        topics: ["ai"],
        goal_mix: { learning: 0.9, entertainment: 0.1 },
        tone: "balanced",
        energy: "medium",
        strictness: 0.7,
      },
      videos: [],
      remainingCount: 3,
      hasMore: true,
      refilling: false,
    });

    await expect(parseFeedPagePayload(response)).resolves.toMatchObject({ sessionId: "s1" });
  });

  it("throws for invalid feed page payload", async () => {
    const response = jsonResponse({ sessionId: 123, videos: [] });
    await expect(parseFeedPagePayload(response)).rejects.toThrow("Invalid feed response from server");
  });

  it("parses signal payload with profile", async () => {
    const response = jsonResponse({
      ok: true,
      profile: {
        deviceId: "d1",
        topicAffinities: { ai: 0.5 },
        channelAffinities: { channel: 0.2 },
        seenVideoIds: ["v1"],
        totalLikes: 1,
        totalSignals: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    await expect(parseSignalPayload(response)).resolves.toMatchObject({ ok: true });
  });

  it("parses error payload safely", async () => {
    const response = jsonResponse({ error: "bad request" }, 400);
    await expect(parseErrorPayload(response)).resolves.toEqual({ error: "bad request" });
  });
});
