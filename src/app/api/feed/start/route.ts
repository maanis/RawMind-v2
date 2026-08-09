import { startFeedSession } from "@/lib/feed/service";
import { log } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";

    if (!prompt || !deviceId) {
      return Response.json({ error: "prompt and deviceId are required" }, { status: 400 });
    }

    if (!(await checkRateLimit(deviceId))) {
      log("warn", "rate_limit_exceeded", { route: "/api/feed/start", deviceId });
      return Response.json({ error: "Too many requests" }, { status: 429 });
    }

    log("info", "feed_start_requested", { deviceId });
    const result = await startFeedSession(prompt, deviceId);
    log("info", "feed_start_succeeded", { deviceId, sessionId: result.sessionId });
    return Response.json(result);
  } catch (error) {
    log("error", "feed_start_failed", { error: error instanceof Error ? error.message : "unknown" });
    return Response.json({ error: "Unable to start feed session" }, { status: 500 });
  }
}
