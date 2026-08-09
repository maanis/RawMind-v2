"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2, ExternalLink, Terminal } from "lucide-react";
import { loadSettings, saveSettings } from "@/lib/rawmind/storage";
import { OLLAMA_DEFAULT_MODEL } from "@/lib/rawmind/personas";

type Status = "idle" | "checking" | "ok" | "error";

export default function RawMindSettingsPage() {
  const [ollamaUrl, setOllamaUrl] = useState("");
  const [model, setModel] = useState(OLLAMA_DEFAULT_MODEL);
  const [status, setStatus] = useState<Status>("idle");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const s = loadSettings();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading localStorage, client-only
    setOllamaUrl(s.ollamaUrl);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading localStorage, client-only
    setModel(s.model || OLLAMA_DEFAULT_MODEL);
  }, []);

  const testConnection = async () => {
    if (!ollamaUrl.trim()) return;
    setStatus("checking");
    setErrorMsg("");
    try {
      const res = await fetch(`/api/rawmind/status?url=${encodeURIComponent(ollamaUrl.trim())}`);
      const data = await res.json();
      if (data.ok) {
        setStatus("ok");
        setAvailableModels(data.models || []);
      } else {
        setStatus("error");
        setErrorMsg(data.error || "Could not connect");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Could not connect");
    }
  };

  const handleSave = () => {
    saveSettings({ ollamaUrl: ollamaUrl.trim(), model: model.trim() || OLLAMA_DEFAULT_MODEL });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen px-6 py-10 md:py-16 max-w-2xl mx-auto space-y-10">
      <div className="space-y-2">
        <p className="text-[10px] tracking-[0.35em] uppercase text-[var(--muted)]">RawMind</p>
        <h1 className="font-display text-3xl tracking-tight">Connect your model</h1>
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          RawMind doesn&apos;t host any AI model itself. It talks to a model running on your own
          machine (or a server you control) through Ollama. Set that up once below, and every
          RawMind persona will use it.
        </p>
      </div>

      {/* Connection form */}
      <div className="card-surface rounded-2xl p-5 space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Ollama server URL</label>
          <input
            value={ollamaUrl}
            onChange={(e) => {
              setOllamaUrl(e.target.value);
              setStatus("idle");
            }}
            placeholder="http://localhost:11434"
            className="w-full bg-white/[0.03] border border-[var(--border)] rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--accent)]/40 transition-colors"
          />
          <p className="text-[11px] text-[var(--muted)]">
            Use <code className="text-[var(--foreground)]">http://localhost:11434</code> if this site
            runs on the same machine as Ollama, or a tunnel URL (ngrok, Cloudflare Tunnel) if it&apos;s
            on another device.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Model name</label>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={OLLAMA_DEFAULT_MODEL}
            className="w-full bg-white/[0.03] border border-[var(--border)] rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--accent)]/40 transition-colors"
          />
          {availableModels.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {availableModels.map((m) => (
                <button
                  key={m}
                  onClick={() => setModel(m)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                    m === model
                      ? "border-[var(--accent)] text-[var(--accent)]"
                      : "border-[var(--border)] text-[var(--muted)] hover:border-white/20"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={testConnection}
            disabled={!ollamaUrl.trim() || status === "checking"}
            className="flex items-center gap-2 text-xs px-4 py-2.5 rounded-full border border-[var(--border)] hover:border-white/20 disabled:opacity-30 transition-colors"
          >
            {status === "checking" && <Loader2 size={13} className="animate-spin" />}
            Test connection
          </button>
          <button
            onClick={handleSave}
            className="flex-1 text-xs font-semibold px-4 py-2.5 rounded-full accent-bg text-black hover:brightness-110 transition-all"
          >
            {saved ? "Saved ✓" : "Save"}
          </button>
        </div>

        {status === "ok" && (
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <CheckCircle2 size={14} /> Connected — {availableModels.length} model
            {availableModels.length === 1 ? "" : "s"} found
          </div>
        )}
        {status === "error" && (
          <div className="flex items-center gap-2 text-xs text-rose-400">
            <XCircle size={14} /> {errorMsg}
          </div>
        )}
      </div>

      {/* Setup docs */}
      <div className="space-y-4">
        <h2 className="font-display text-xl tracking-tight flex items-center gap-2">
          <Terminal size={18} className="accent-text" />
          Setting up Ollama
        </h2>

        <ol className="space-y-4">
          <li className="card-surface rounded-xl p-4 space-y-1.5">
            <p className="text-sm font-medium">1. Install Ollama</p>
            <p className="text-xs text-[var(--muted)]">
              Download it for your OS from{" "}
              <a
                href="https://ollama.com/download"
                target="_blank"
                rel="noreferrer"
                className="accent-text inline-flex items-center gap-1 underline underline-offset-2"
              >
                ollama.com/download <ExternalLink size={11} />
              </a>{" "}
              and install it like any regular app.
            </p>
          </li>

          <li className="card-surface rounded-xl p-4 space-y-1.5">
            <p className="text-sm font-medium">2. Pull an uncensored model</p>
            <p className="text-xs text-[var(--muted)]">Open a terminal and run:</p>
            <pre className="bg-black/40 border border-[var(--border)] rounded-lg p-3 text-xs overflow-x-auto"><code>ollama pull dolphin-mixtral</code></pre>
            <p className="text-xs text-[var(--muted)]">
              Smaller machine? Try <code className="text-[var(--foreground)]">dolphin-mistral</code> or
              a quantized variant instead — check the model&apos;s page on{" "}
              <a href="https://ollama.com/library" target="_blank" rel="noreferrer" className="accent-text underline underline-offset-2">
                ollama.com/library
              </a>{" "}
              for size/quality tradeoffs.
            </p>
          </li>

          <li className="card-surface rounded-xl p-4 space-y-1.5">
            <p className="text-sm font-medium">3. Make sure Ollama is running</p>
            <p className="text-xs text-[var(--muted)]">
              It usually starts automatically after install and listens on{" "}
              <code className="text-[var(--foreground)]">http://localhost:11434</code>. You can check with:
            </p>
            <pre className="bg-black/40 border border-[var(--border)] rounded-lg p-3 text-xs overflow-x-auto"><code>curl http://localhost:11434/api/tags</code></pre>
          </li>

          <li className="card-surface rounded-xl p-4 space-y-1.5">
            <p className="text-sm font-medium">4. Point RawMind at it</p>
            <p className="text-xs text-[var(--muted)]">
              If this website and Ollama are on the same computer, use{" "}
              <code className="text-[var(--foreground)]">http://localhost:11434</code> above. If the
              website is deployed elsewhere (e.g. Vercel) and Ollama stays on your own machine,
              expose it with a tunnel first, then paste that URL instead:
            </p>
            <pre className="bg-black/40 border border-[var(--border)] rounded-lg p-3 text-xs overflow-x-auto"><code>ngrok http 11434</code></pre>
            <p className="text-xs text-[var(--muted)]">
              Then use the <code className="text-[var(--foreground)]">https://...ngrok-free.app</code>{" "}
              URL it prints. Anyone with that URL can reach your Ollama server while the tunnel is
              open, so only share it with people you trust and close the tunnel when you&apos;re done.
            </p>
          </li>
        </ol>
      </div>
    </div>
  );
}
