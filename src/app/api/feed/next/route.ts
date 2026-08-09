import { getNextFeedPage } from "@/lib/feed/service";
import { log } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";

    if (!sessionId || !deviceId) {
      return Response.json({ error: "sessionId and deviceId are required" }, { status: 400 });
    }

    if (!(await checkRateLimit(deviceId))) {
      log("warn", "rate_limit_exceeded", { route: "/api/feed/next", deviceId });
      return Response.json({ error: "Too many requests" }, { status: 429 });
    }

    log("info", "feed_next_requested", { deviceId, sessionId });
    const result = await getNextFeedPage(sessionId, deviceId);
    log("info", "feed_next_succeeded", { deviceId, sessionId, returned: result.videos?.length ?? 0 });
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load next feed page";
    const status = message === "Feed session not found" ? 404 : 500;
    if (status === 500) {
      log("error", "feed_next_failed", {
        error: error instanceof Error ? error.message : "unknown",
      });
    }
    return Response.json({ error: message }, { status });
  }
}
