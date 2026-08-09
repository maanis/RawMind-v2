"use client";

import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, Send, Trash2, Settings, Loader2 } from "lucide-react";
import {
  getPersonaById,
  getSystemPrompt,
  PersonaId,
  Religion,
  RELIGIONS,
  CONTEXT_WINDOW,
} from "@/lib/rawmind/personas";
import {
  ChatMessage,
  loadChat,
  saveChat,
  clearChat,
  loadSettings,
} from "@/lib/rawmind/storage";

function ChatContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const personaId = (searchParams.get("persona") as PersonaId) || "raw";
  const religion = (searchParams.get("religion") as Religion) || undefined;

  const persona = getPersonaById(personaId);
  const religionLabel = RELIGIONS.find((r) => r.id === religion)?.label;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [backendMissing, setBackendMissing] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamingIdRef = useRef<string | null>(null);

  useEffect(() => {
    setMessages(loadChat(personaId, religion));
    const settings = loadSettings();
    setBackendMissing(!settings.ollamaUrl);
  }, [personaId, religion]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || streaming) return;

    const settings = loadSettings();
    if (!settings.ollamaUrl) {
      setBackendMissing(true);
      return;
    }

    setError("");
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
    };
    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    };
    streamingIdRef.current = assistantMsg.id;

    const nextMessages = [...messages, userMsg];
    setMessages([...nextMessages, assistantMsg]);
    setInput("");
    setStreaming(true);

    const systemPrompt = getSystemPrompt(personaId, religion);
    const context = nextMessages.slice(-CONTEXT_WINDOW).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/rawmind/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ollamaUrl: settings.ollamaUrl,
          model: settings.model,
          messages: [{ role: "system", content: systemPrompt }, ...context],
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Something went wrong reaching your model.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: accumulated } : m))
        );
      }

      const finalMessages = [
        ...nextMessages,
        { ...assistantMsg, content: accumulated },
      ];
      setMessages(finalMessages);
      saveChat(personaId, finalMessages, religion);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to get a response.");
      setMessages(nextMessages);
    } finally {
      setStreaming(false);
      streamingIdRef.current = null;
    }
  }, [input, messages, personaId, religion, streaming]);

  const handleClear = () => {
    clearChat(personaId, religion);
    setMessages([]);
  };

  return (
    <div className="h-screen w-full flex flex-col bg-[#0a0a0b]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push("/rawmind")}
            className="p-2 rounded-full hover:bg-white/5 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors shrink-0"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <p className="font-display text-base tracking-tight truncate">
              {persona.name}
              {religionLabel ? ` · ${religionLabel}` : ""}
            </p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">{persona.label}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleClear}
            title="Clear conversation"
            className="p-2 rounded-full hover:bg-white/5 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={() => router.push("/rawmind/settings")}
            title="Settings"
            className="p-2 rounded-full hover:bg-white/5 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-5">
          {messages.length === 0 && (
            <div className="text-center py-16 space-y-2">
              <div className="text-2xl accent-text w-12 h-12 mx-auto flex items-center justify-center rounded-2xl bg-[var(--accent-soft)]">
                {persona.icon}
              </div>
              <p className="text-sm text-[var(--muted)] max-w-xs mx-auto">{persona.description}</p>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-[var(--accent)] text-black"
                    : "card-surface text-[var(--foreground)]"
                }`}
              >
                {m.content ? (
                  m.role === "assistant" ? (
                    <div className="prose-chat">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )
                ) : (
                  <span className="inline-flex gap-1 py-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-current opacity-40 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </span>
                )}
              </div>
            </div>
          ))}

          {error && (
            <div className="text-center text-xs text-rose-400 bg-rose-400/10 border border-rose-400/20 rounded-xl px-4 py-3 max-w-md mx-auto">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Backend missing banner */}
      {backendMissing && (
        <div className="px-4 pb-2">
          <button
            onClick={() => router.push("/rawmind/settings")}
            className="max-w-2xl mx-auto w-full flex items-center justify-center gap-2 text-xs text-[var(--accent)] bg-[var(--accent-soft)] border border-[var(--accent)]/20 rounded-xl py-2.5"
          >
            Connect your Ollama server to start chatting →
          </button>
        </div>
      )}

      {/* Composer */}
      <div className="border-t border-white/[0.06] px-4 py-3 shrink-0">
        <div className="max-w-2xl mx-auto flex items-end gap-2 card-surface rounded-2xl p-2">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder={`Message ${persona.name}...`}
            className="flex-1 bg-transparent outline-none resize-none px-3 py-2.5 text-sm no-scrollbar max-h-32"
          />
          <button
            onClick={() => void send()}
            disabled={!input.trim() || streaming}
            className="p-3 accent-bg text-black rounded-xl disabled:opacity-20 transition-all shrink-0"
          >
            {streaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RawMindChatPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0b]" />}>
      <ChatContent />
    </Suspense>
  );
}
