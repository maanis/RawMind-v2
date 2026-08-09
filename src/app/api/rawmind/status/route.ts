import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const ollamaUrl = (req.nextUrl.searchParams.get("url") || "").trim().replace(/\/+$/, "");

  if (!ollamaUrl || !isValidHttpUrl(ollamaUrl)) {
    return NextResponse.json({ ok: false, error: "Invalid URL" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(`${ollamaUrl}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `Server responded ${res.status}` }, { status: 200 });
    }
    const data = await res.json();
    const models: string[] = (data?.models ?? []).map((m: { name?: string }) => m.name ?? "").filter(Boolean);
    return NextResponse.json({ ok: true, models });
  } catch {
    clearTimeout(timeout);
    return NextResponse.json({ ok: false, error: "Could not reach that URL" }, { status: 200 });
  }
}
