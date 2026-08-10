import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { FeedSignal, GeneratedQueryPlan, IntentProfile, UserProfile } from "@/lib/feed/types";
import { log } from "@/lib/logger";
import { redisGetJson, redisSetJson } from "@/lib/cache/redis";

const apiKey = (process.env.GEMINI_API_KEY || "").trim().replace(/^["']|["']$/g, "");
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const DEFAULT_MODEL = "gemini-2.5-flash";

function fallbackIntentProfile(userInput: string): IntentProfile {
  return {
    topics: userInput
      .split(/[,.!?]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 4),
    goal_mix: {
      learning: 0.65,
      entertainment: 0.35,
    },
    tone: "balanced",
    energy: "medium",
    strictness: 0.65,
  };
}

function fallbackQueryPlan(userInput: string): GeneratedQueryPlan {
  const normalizedIntent = userInput.trim().replace(/\s+/g, " ");
  const seed = normalizedIntent || "interesting videos";
  const intentProfile = fallbackIntentProfile(seed);
  const searchQueries = [
    seed,
    `${seed} explained`,
    `${seed} best videos`,
    `${seed} deep dive`,
  ];

  return {
    normalizedIntent: seed,
    searchQueries: Array.from(new Set(searchQueries)).slice(0, 5),
    intentProfile,
  };
}

async function callGeminiWithRetry<T>(fn: () => Promise<T>, retries = 1, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: unknown) {
    const status = typeof error === "object" && error !== null && "status" in error ? error.status : null;
    if (status === 429 && retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return callGeminiWithRetry(fn, retries - 1, delay * 2);
    }

    throw error;
  }
}

export async function generateQueryPlan(
  userInput: string,
  profile?: UserProfile | null,
  signals: FeedSignal[] = []
): Promise<GeneratedQueryPlan> {
  const promptSignature = userInput.trim().toLowerCase().replace(/\s+/g, " ");
  const cacheKey = `queryplan:${promptSignature}`;
  const cachedPlan = await redisGetJson<GeneratedQueryPlan>(cacheKey);
  if (cachedPlan) {
    log("info", "gemini_plan_cache_hit", { cacheKey });
    return cachedPlan;
  }

  if (!genAI) {
    log("warn", "gemini_unconfigured_fallback", { inputLength: userInput.length });
    const plan = fallbackQueryPlan(userInput);
    await redisSetJson(cacheKey, plan, 3600);
    return plan;
  }

  try {
    const model = genAI.getGenerativeModel({
      model: DEFAULT_MODEL,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            normalizedIntent: {
              type: SchemaType.STRING,
            },
            searchQueries: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
            },
            intentProfile: {
              type: SchemaType.OBJECT,
              properties: {
                topics: {
                  type: SchemaType.ARRAY,
                  items: { type: SchemaType.STRING },
                },
                goal_mix: {
                  type: SchemaType.OBJECT,
                  properties: {
                    learning: { type: SchemaType.NUMBER },
                    entertainment: { type: SchemaType.NUMBER },
                  },
                  required: ["learning", "entertainment"],
                },
                tone: {
                  type: SchemaType.STRING,
                  enum: ["light", "serious", "fun", "balanced"],
                  format: "enum",
                },
                energy: {
                  type: SchemaType.STRING,
                  enum: ["low", "medium", "high"],
                  format: "enum",
                },
                strictness: { type: SchemaType.NUMBER },
              },
              required: ["topics", "goal_mix", "tone", "energy", "strictness"],
            },
          },
          required: ["normalizedIntent", "searchQueries", "intentProfile"],
        },
      },
    });

    const prompt = `
You are the query planner for RawMind, an intent-first short-video feed.

User prompt:
"${userInput}"

Anonymous device profile:
${JSON.stringify(profile ?? null)}

Recent feedback signals:
${JSON.stringify(signals.slice(0, 10))}

Return JSON only.

Rules:
1. Understand the deeper intent, not just keywords.
2. Produce 3 to 5 YouTube-ready search queries that maximize relevant video discovery in the first acquisition batch.
3. Keep the queries diverse but still tightly aligned to the user's intent.
4. The intentProfile should stay lightweight and useful for ranking.
5. Do not mention any APIs or implementation details in the output.
6. Make normalizedIntent a clean natural-language summary of what the user actually wants.
`;

    log("info", "gemini_call_started", { inputLength: userInput.length, signals: signals.length });
    const result = await callGeminiWithRetry(() => model.generateContent(prompt));
    const text = result.response.text();
    const parsed = JSON.parse(text) as GeneratedQueryPlan;
    log("info", "gemini_call_succeeded", { queries: parsed.searchQueries?.length ?? 0 });

    const plan = {
      normalizedIntent: parsed.normalizedIntent?.trim() || userInput.trim(),
      searchQueries: Array.from(new Set((parsed.searchQueries ?? []).map((query) => query.trim()).filter(Boolean))).slice(
        0,
        5
      ),
      intentProfile: {
        ...parsed.intentProfile,
        topics: Array.from(new Set((parsed.intentProfile?.topics ?? []).map((topic) => topic.trim()).filter(Boolean))).slice(
          0,
          6
        ),
      },
    };
    await redisSetJson(cacheKey, plan, 3600);
    return plan;
  } catch (error) {
    log("error", "gemini_call_failed", { error: error instanceof Error ? error.message : "unknown" });
    const plan = fallbackQueryPlan(userInput);
    await redisSetJson(cacheKey, plan, 3600);
    return plan;
  }
}

export type { GeneratedQueryPlan, IntentProfile, FeedSignal, UserProfile };
