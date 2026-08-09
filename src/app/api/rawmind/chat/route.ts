import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface IncomingMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatRequestBody {
  ollamaUrl: string;
  model: string;
  messages: IncomingMessage[];
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  let body: ChatRequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const ollamaUrl = (body.ollamaUrl || "").trim().replace(/\/+$/, "");
  const model = (body.model || "").trim();
  const messages = Array.isArray(body.messages) ? body.messages : [];

  if (!ollamaUrl || !isValidHttpUrl(ollamaUrl)) {
    return new Response(
      "No valid Ollama URL configured. Add one in RawMind > Settings.",
      { status: 400 }
    );
  }
  if (!model) {
    return new Response("No model specified. Set one in RawMind > Settings.", {
      status: 400,
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  let upstream: Response;
  try {
    upstream = await fetch(`${ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        options: {
          temperature: 0.7,
          top_p: 0.92,
          repeat_penalty: 1.1,
        },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "Timed out waiting for your Ollama server."
        : `Couldn't reach ${ollamaUrl}. Make sure Ollama is running and the URL is reachable from this server.`;
    return new Response(message, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    clearTimeout(timeout);
    const text = await upstream.text().catch(() => "");
    return new Response(
      `Ollama responded with an error${text ? `: ${text}` : "."}`,
      { status: 502 }
    );
  }

  // Transform Ollama's newline-delimited JSON stream into plain text tokens.
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(streamController) {
      const reader = upstream.body!.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const json = JSON.parse(trimmed);
              const content: string = json?.message?.content ?? "";
              if (content) streamController.enqueue(encoder.encode(content));
              if (json?.done) {
                streamController.close();
                return;
              }
            } catch {
              // skip malformed line
            }
          }
        }
        streamController.close();
      } catch {
        streamController.close();
      } finally {
        clearTimeout(timeout);
        try {
          reader.releaseLock();
        } catch {
          // ignore
        }
      }
    },
    cancel() {
      controller.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
