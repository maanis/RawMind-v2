import { recordFeedSignal } from "@/lib/feed/service";
import { log } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
    const videoId = typeof body.videoId === "string" ? body.videoId.trim() : "";
    const type = body.type === "watchTime" || body.type === "like" ? body.type : null;

    if (!sessionId || !deviceId || !videoId || !type) {
      return Response.json({ error: "sessionId, deviceId, videoId, and type are required" }, { status: 400 });
    }

    if (!(await checkRateLimit(deviceId))) {
      log("warn", "rate_limit_exceeded", { route: "/api/feed/signal", deviceId });
      return Response.json({ error: "Too many requests" }, { status: 429 });
    }

    const result = await recordFeedSignal({
      sessionId,
      deviceId,
      videoId,
      type,
      value: body.value,
      timestamp: typeof body.timestamp === "number" ? body.timestamp : Date.now(),
    });

    log("info", "feed_signal_recorded", { deviceId, sessionId, videoId, type });
    return Response.json(result);
  } catch (error) {
    log("error", "feed_signal_failed", { error: error instanceof Error ? error.message : "unknown" });
    return Response.json({ error: "Unable to record signal" }, { status: 500 });
  }
}
