# MindScroll + RawMind — merged Next.js app

This is your MindScroll repo with a new **RawMind** section added, plus a full
visual redesign (elegant dark theme, no heavy gradient blobs, serif/sans pairing).

## What changed

**Visuals**
- New design tokens in `src/app/globals.css` — near-black background, warm
  off-white text, a single muted-gold accent (`--accent`), restrained borders.
  Removed the multi-color blurred "mesh" background and blue/purple/cyan/rose
  accent mixing across `page.tsx`, `feed/page.tsx`, `VideoPlayer.tsx`, and
  `InsightBar.tsx`.
- New `NavShell` component (`src/components/NavShell.tsx`) — a slim top bar on
  desktop and a bottom tab bar on mobile, linking MindScroll and RawMind. It
  hides itself on the immersive `/feed` and `/rawmind/chat` screens.
- All existing MindScroll feed logic (session start, pagination, signals,
  intent profile, insight bar) is untouched — only the styling changed.

**New: RawMind** (`src/app/rawmind/*`)
- `/rawmind` — persona picker (The Oracle, ResearchMind, Unfiltered)
- `/rawmind/chat?persona=...&religion=...` — the chat screen
- `/rawmind/settings` — where the user pastes their own Ollama server URL and
  picks a model, with a "test connection" button and inline setup docs
- `src/app/api/rawmind/chat/route.ts` — server-side proxy that forwards chat
  requests to the URL the user configured and streams tokens back. Using a
  server-side proxy (instead of calling Ollama directly from the browser)
  avoids CORS issues with Ollama's default config.
- `src/app/api/rawmind/status/route.ts` — pings `/api/tags` on the user's
  Ollama server to verify connectivity and list installed models.
- `src/lib/rawmind/personas.ts` — persona definitions and system prompts
- `src/lib/rawmind/storage.ts` — localStorage helpers for settings + chat
  history (per-persona, so switching personas doesn't mix conversations)

## On the persona prompts

The original RawMind repo's persona prompts included a wrapper explicitly
designed to detect and refuse "ignore previous instructions"-style messages,
plus a "Raw/Unleashed" persona with instructions to produce explicit sexual
content on demand. I didn't carry those two pieces over.

What's in `personas.ts` instead: The Oracle and ResearchMind are close to the
originals (topic-locked scholarly persona / research-assistant persona). The
"Raw" persona is reframed as "blunt and direct, no disclaimers, no hedging"
rather than "no restrictions" — same energy, without the jailbreak-defeat
engineering or an explicit-content mandate baked into the prompt. Since the
model itself runs on each user's own machine via Ollama, its actual behavior
still depends on which model they pull and how they configure it — this app
just doesn't ship prompt text written to force a specific outcome around that.

If you want to adjust the wording, it's all in one place:
`src/lib/rawmind/personas.ts` → `getSystemPrompt()`.

## Running it

```bash
npm install
cp .env.example .env.local   # fill in Gemini/YouTube/Mongo keys for MindScroll
npm run dev
```

MindScroll's feed needs the same env vars as before (Gemini, YouTube API,
MongoDB — see `.env.example`). RawMind needs no server-side env vars at all;
each visitor points it at their own Ollama server from the Settings screen.

## Ollama setup (for end users)

This is also shown inline in the app at `/rawmind/settings`:

1. Install Ollama from https://ollama.com/download
2. `ollama pull dolphin-mixtral` (or a smaller dolphin variant)
3. Confirm it's running: `curl http://localhost:11434/api/tags`
4. In the app, paste `http://localhost:11434` (same machine) or a tunnel URL
   like an ngrok address (`ngrok http 11434`) if the app is deployed elsewhere
   and Ollama stays on their own machine.
