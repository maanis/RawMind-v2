"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Terminal,
  Download,
  Apple,
  MonitorCog,
  Copy,
  ArrowUp,
} from "lucide-react";
import { loadSettings, saveSettings } from "@/lib/rawmind/storage";
import { OLLAMA_DEFAULT_MODEL, RAWMIND_MODEL_NAME } from "@/lib/rawmind/personas";

type Status = "idle" | "checking" | "ok" | "error";
type OSTab = "windows" | "mac";
const DEFAULT_LOCAL_URL = "http://localhost:11434";

export default function RawMindSettingsPage() {
  const [ollamaUrl, setOllamaUrl] = useState("");
  const [model, setModel] = useState(OLLAMA_DEFAULT_MODEL);
  const [rawModel, setRawModel] = useState(RAWMIND_MODEL_NAME);
  const [status, setStatus] = useState<Status>("idle");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [saved, setSaved] = useState(false);

  // Manual Setup State
  const [osTab, setOsTab] = useState<OSTab>("windows");
  const [copiedId, setCopiedId] = useState<string>("");

  const testConnection = useCallback(async (url: string) => {
    const clean = url.trim().replace(/\/+$/, "");
    if (!clean) return;
    setStatus("checking");
    setErrorMsg("");
    try {
      const res = await fetch(`${clean}/api/tags`);
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const data = await res.json();
      const models: string[] = (data?.models ?? [])
        .map((m: { name?: string }) => m.name ?? "")
        .filter(Boolean);
      setStatus("ok");
      setAvailableModels(models);
    } catch {
      setStatus("error");
      setErrorMsg("Not connected yet — run the setup script below, then it'll pick this up automatically.");
    }
  }, []);

  useEffect(() => {
    const s = loadSettings();
    const url = s.ollamaUrl || DEFAULT_LOCAL_URL;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOllamaUrl(url);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setModel(s.model || OLLAMA_DEFAULT_MODEL);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRawModel(s.rawModel || RAWMIND_MODEL_NAME);

    void testConnection(url);
    const retry1 = setTimeout(() => void testConnection(url), 4000);
    const retry2 = setTimeout(() => void testConnection(url), 10000);
    return () => {
      clearTimeout(retry1);
      clearTimeout(retry2);
    };
  }, [testConnection]);

  const handleSave = () => {
    saveSettings({
      ollamaUrl: ollamaUrl.trim().replace(/\/+$/, ""),
      model: model.trim() || OLLAMA_DEFAULT_MODEL,
      rawModel: rawModel.trim(),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Helper for rendering copyable code blocks
  const renderCodeBlock = (id: string, code: string) => (
    <div className="relative group mt-2">
      <pre className="bg-black/40 border border-[var(--border)] rounded-lg p-3 text-xs overflow-x-auto pr-12">
        <code>{code}</code>
      </pre>
      <button
        onClick={() => {
          navigator.clipboard.writeText(code);
          setCopiedId(id);
          setTimeout(() => setCopiedId(""), 2000);
        }}
        className="absolute top-2 right-2 p-1.5 rounded-md bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10 border border-white/10"
        title="Copy command"
      >
        {copiedId === id ? (
          <CheckCircle2 size={14} className="text-emerald-400" />
        ) : (
          <Copy size={14} className="text-gray-400 hover:text-white transition-colors" />
        )}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen px-6 py-10 md:py-16 max-w-2xl mx-auto space-y-10">
      <div className="space-y-2">
        <p className="text-[10px] tracking-[0.35em] uppercase text-[var(--muted)]">RawMind</p>
        <h1 className="font-display text-3xl tracking-tight">Connect your model</h1>
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          RawMind doesn&apos;t host any AI model itself. It talks to a model running on your own
          machine through Ollama. Set that up once below, and every RawMind persona will use it.
        </p>
      </div>

      {/* Setup Instructions */}
      <div className="card-surface rounded-2xl p-5 space-y-4 shadow-lg border border-[var(--border)]">
        <div className="flex items-center gap-2">
          <Download size={16} className="accent-text" />
          <h2 className="text-sm font-semibold">Set up on the PC running the model</h2>
        </div>
        <p className="text-xs text-[var(--muted)] leading-relaxed">
          Run this on the computer with Ollama installed — not on this phone. It sets everything
          up and opens a Cloudflare tunnel so this phone can reach it, then prints (and copies)
          a URL like <code className="text-[var(--foreground)]">https://xxxx.trycloudflare.com</code>.
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href="/setup/start-rawmind-mac.sh"
            download
            className="flex items-center gap-2 text-xs px-4 py-2.5 rounded-full accent-bg text-black font-semibold hover:brightness-110 transition-all shadow-sm"
          >
            <Apple size={14} /> macOS / Linux
          </a>
          <a
            href="/setup/start-rawmind-windows.bat"
            download
            className="flex items-center gap-2 text-xs px-4 py-2.5 rounded-full border border-[var(--border)] hover:border-white/20 transition-colors shadow-sm bg-white/5"
          >
            <MonitorCog size={14} /> Windows
          </a>
        </div>
        <p className="text-[11px] text-amber-400/90 bg-amber-400/10 border border-amber-400/20 rounded-xl px-3 py-2 leading-relaxed">
          Keep that script&apos;s window open the whole time you use RawMind — closing it stops
          the tunnel. The URL it gives you also changes every time you re-run it, since it&apos;s a
          fresh quick-tunnel each time.
        </p>
        <div className="space-y-1.5 pt-1">
          <label className="text-xs uppercase tracking-wide text-[var(--muted)] font-medium">
            Paste the tunnel URL here
          </label>
          <input
            value={ollamaUrl}
            onChange={(e) => {
              setOllamaUrl(e.target.value);
              setStatus("idle");
            }}
            placeholder="https://xxxx-xxxx.trycloudflare.com"
            className="w-full bg-black/40 border border-[var(--border)] rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/20 transition-all shadow-inner"
          />
        </div>
      </div>

      {/* Connection status + save */}
      <div className="card-surface rounded-2xl p-5 space-y-4 border border-[var(--border)]">
        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wide text-[var(--muted)] font-medium">Model name</label>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={OLLAMA_DEFAULT_MODEL}
            className="w-full bg-black/40 border border-[var(--border)] rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/20 transition-all"
          />
          {availableModels.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {availableModels.map((m) => (
                <button
                  key={m}
                  onClick={() => setModel(m)}
                  className={`text-[11px] px-3 py-1.5 rounded-full border transition-all shadow-sm ${m === model
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                    : "border-[var(--border)] bg-white/5 text-[var(--muted)] hover:border-white/30 hover:text-[var(--foreground)]"
                    }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wide text-[var(--muted)] font-medium">
            Custom model for &quot;Raw&quot; persona <span className="opacity-60 font-normal">(optional)</span>
          </label>
          <input
            value={rawModel}
            onChange={(e) => setRawModel(e.target.value)}
            placeholder="e.g. yourname/rawmind"
            className="w-full bg-black/40 border border-[var(--border)] rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/20 transition-all"
          />
          <p className="text-[11px] text-[var(--muted)] leading-relaxed mt-1">
            If you built a custom model from your own Modelfile (with its own baked-in system
            prompt), put its name here. When set, only the <span className="text-[var(--foreground)] font-medium">Raw</span> persona
            uses this model, and the app won&apos;t send its own system prompt — your Modelfile&apos;s
            takes over instead.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-[var(--border)] mt-2">
          <button
            onClick={() => testConnection(ollamaUrl)}
            disabled={!ollamaUrl.trim() || status === "checking"}
            className="flex items-center gap-2 text-xs px-5 py-2.5 rounded-full border border-[var(--border)] bg-white/5 hover:bg-white/10 disabled:opacity-40 transition-all shadow-sm font-medium mt-4"
          >
            {status === "checking" && <Loader2 size={14} className="animate-spin" />}
            Test connection
          </button>
          <button
            onClick={handleSave}
            className="flex-1 text-xs font-semibold px-5 py-2.5 rounded-full accent-bg text-black hover:brightness-110 transition-all shadow-sm mt-4"
          >
            {saved ? "Saved ✓" : "Save Changes"}
          </button>
        </div>

        {status === "ok" && (
          <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 p-3 rounded-xl mt-2">
            <CheckCircle2 size={16} /> Connected — {availableModels.length} model
            {availableModels.length === 1 ? "" : "s"} found on server
          </div>
        )}
        {status === "error" && (
          <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-400/10 border border-rose-400/20 p-3 rounded-xl mt-2">
            <XCircle size={16} className="shrink-0" /> <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Manual fallback + troubleshooting */}
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="font-display text-xl tracking-tight flex items-center gap-2">
            <Terminal size={20} className="accent-text" />
            Prefer to do it manually?
          </h2>
          <p className="text-xs text-[var(--muted)] leading-relaxed max-w-xl">
            Don&apos;t want to run a script you haven&apos;t read? Fair — here&apos;s every command it
            runs, so you can copy-paste them one at a time instead.
          </p>
        </div>

        {/* OS Tab Switcher */}
        <div className="flex gap-2 p-1 card-surface rounded-full max-w-sm border border-[var(--border)]">
          <button
            onClick={() => setOsTab("windows")}
            className={`flex-1 flex items-center justify-center gap-2 text-xs font-semibold py-2 rounded-full transition-all ${osTab === "windows" ? "accent-bg text-black shadow-sm" : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
          >
            <MonitorCog size={14} /> Windows
          </button>
          <button
            onClick={() => setOsTab("mac")}
            className={`flex-1 flex items-center justify-center gap-2 text-xs font-semibold py-2 rounded-full transition-all ${osTab === "mac" ? "accent-bg text-black shadow-sm" : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
          >
            <Apple size={14} /> Mac / Linux
          </button>
        </div>

        <ol className="space-y-4">
          <li className="card-surface rounded-xl p-5 space-y-2 border border-[var(--border)]">
            <p className="text-sm font-semibold flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[var(--border)] text-[10px]">1</span>
              Install Ollama
            </p>
            <p className="text-xs text-[var(--muted)] pl-7">
              Download and install Ollama from{" "}
              <a href="https://ollama.com/download" target="_blank" rel="noreferrer" className="accent-text inline-flex items-center gap-1 underline underline-offset-2 hover:brightness-110">
                ollama.com/download <ExternalLink size={11} />
              </a>.
            </p>
          </li>

          <li className="card-surface rounded-xl p-5 space-y-2 border border-[var(--border)]">
            <p className="text-sm font-semibold flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[var(--border)] text-[10px]">2</span>
              Force Stop & Clean Port 11434
            </p>
            <div className="pl-7 space-y-2">
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                Ollama usually runs automatically in the background. To set custom environment variables safely, we must forcefully kill any existing processes using the required port.
              </p>
              {osTab === "windows"
                ? renderCodeBlock("clean-win", `FOR /F "tokens=5" %a in ('netstat -aon ^| findstr :11434') do taskkill /f /pid %a`)
                : renderCodeBlock("clean-mac", `lsof -ti:11434 | xargs kill -9`)
              }
            </div>
          </li>

          <li className="card-surface rounded-xl p-5 space-y-2 border border-[var(--border)]">
            <p className="text-sm font-semibold flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[var(--border)] text-[10px]">3</span>
              Start Ollama with Network Access
            </p>
            <div className="pl-7 space-y-2">
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                By default, Ollama only listens to local requests. These commands configure it to accept incoming connections from the Cloudflare tunnel.
              </p>
              {osTab === "windows"
                ? renderCodeBlock("start-win", `set OLLAMA_ORIGINS="*" && set OLLAMA_HOST="0.0.0.0:11434" && ollama serve`)
                : renderCodeBlock("start-mac", `export OLLAMA_ORIGINS="*" && export OLLAMA_HOST="0.0.0.0:11434" && ollama serve`)
              }
            </div>
          </li>

          <li className="card-surface rounded-xl p-5 space-y-2 border border-[var(--border)]">
            <p className="text-sm font-semibold flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[var(--border)] text-[10px]">4</span>
              Pull the AI Model
            </p>
            <div className="pl-7 space-y-2">
              <p className="text-xs text-[var(--muted)]">
                Open a <strong>new terminal window</strong> (keep the previous one running) and pull the core model:
              </p>
              {renderCodeBlock("pull-model", `ollama pull ${RAWMIND_MODEL_NAME}`)}
            </div>
          </li>

          <li className="card-surface rounded-xl p-5 space-y-2 border border-[var(--border)]">
            <p className="text-sm font-semibold flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[var(--border)] text-[10px]">5</span>
              Install Cloudflared & Open Tunnel
            </p>
            <div className="pl-7 space-y-3">
              <p className="text-xs text-[var(--muted)]">First, install the Cloudflare daemon:</p>
              {osTab === "windows"
                ? renderCodeBlock("install-cf-win", `winget install --id Cloudflare.cloudflared`)
                : renderCodeBlock("install-cf-mac", `brew install cloudflare/cloudflare/cloudflared`)
              }
              <p className="text-xs text-[var(--muted)] pt-2 border-t border-[var(--border)]">Then, start the tunnel pointing to your Ollama server:</p>
              {renderCodeBlock("run-tunnel", `cloudflared tunnel --url http://localhost:11434`)}
            </div>
          </li>

          <li className="card-surface rounded-xl p-5 space-y-3 border border-[var(--accent)]/50 bg-[var(--accent)]/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Terminal size={64} />
            </div>
            <p className="text-sm font-semibold flex items-center gap-2 text-[var(--accent)] relative z-10">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[var(--accent)] text-black text-[10px]">6</span>
              Connect to RawMind
            </p>
            <div className="pl-7 space-y-3 relative z-10">
              <p className="text-xs text-[var(--foreground)] leading-relaxed">
                Look at the terminal output from Step 5. Copy the generated URL that ends with <code className="bg-black/30 px-1 py-0.5 rounded text-[var(--accent)]">.trycloudflare.com</code>.
              </p>
              <div className="bg-black/40 border border-amber-500/20 rounded-lg p-3 space-y-2">
                <p className="text-xs text-amber-400/90 font-medium flex items-center gap-2">
                  <ArrowUp size={14} className="animate-bounce" /> Action Required:
                </p>
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  Scroll back to the top of this page and paste that exact URL into the <strong className="text-white">"Paste the tunnel URL here"</strong> input box, then click <strong>Save Changes</strong>.
                </p>
              </div>
            </div>
          </li>
        </ol>
      </div>
    </div>
  );
}