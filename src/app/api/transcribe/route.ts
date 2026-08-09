import { transcribeAudioWithNvidia } from "@/lib/ai/nvidia-whisper";
import { log } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const rateLimitKey = forwardedFor || "unknown-ip";
    if (!(await checkRateLimit(rateLimitKey))) {
      log("warn", "rate_limit_exceeded", { route: "/api/transcribe", key: rateLimitKey });
      return Response.json({ error: "Too many requests" }, { status: 429 });
    }

    const formData = await request.formData();
    const audio = formData.get("audio");
    const languageValue = formData.get("language");
    const language = typeof languageValue === "string" && languageValue.trim() ? languageValue.trim() : "en";

    if (!(audio instanceof File)) {
      return Response.json({ error: "Audio file is required" }, { status: 400 });
    }

    if (audio.size === 0) {
      return Response.json({ error: "Audio file is empty" }, { status: 400 });
    }

    const text = await transcribeAudioWithNvidia(audio, language);
    log("info", "transcribe_succeeded", { key: rateLimitKey, chars: text.length });
    return Response.json({ text });
  } catch (error) {
    log("error", "transcribe_failed", { error: error instanceof Error ? error.message : "unknown" });
    const message = error instanceof Error ? error.message : "Unable to transcribe audio";
    return Response.json({ error: message }, { status: 500 });
  }
}
