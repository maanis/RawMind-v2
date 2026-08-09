import { refreshPools } from "@/lib/cron/refreshPools";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const headerSecret = request.headers.get("x-cron-secret")?.trim();
  return bearer === secret || headerSecret === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await refreshPools();
    return Response.json(result);
  } catch (error) {
    log("error", "refresh_pools_failed", { error: error instanceof Error ? error.message : "unknown" });
    return Response.json({ ok: false, error: "Unable to refresh pools" }, { status: 500 });
  }
}
