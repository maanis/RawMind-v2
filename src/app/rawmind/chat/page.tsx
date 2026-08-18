"use client";

import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUp,
  Settings,
  Loader2,
  Plus,
  SlidersHorizontal,
  Zap,
  Brain,
  MessageSquare,
  Crown,
  Sun,
  Moon,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Volume2,
  Menu,
  Home,
  X,
  PanelLeftClose,
  PanelLeft
} from "lucide-react";
import {
  PERSONAS,
  getPersonaById,
  getSystemPrompt,
  PersonaId,
  Religion,
  RELIGIONS,
  CONTEXT_WINDOW,
} from "@/lib/rawmind/personas";
import {
  ChatMessage,
  loadSettings,
} from "@/lib/rawmind/storage";

// --- Custom Session Types ---
type ChatSession = {
  id: string;
  personaId: PersonaId;
  religion?: Religion;
  title: string;
  updatedAt: number;
  messages: ChatMessage[];
};

const STORAGE_KEY = "rawmind_sessions";
const USERNAME_STORAGE_KEY = "rawmind_user_name";

const getTimeGreeting = (name?: string) => {
  const hour = new Date().getHours();

  if (hour < 12) return `Good morning${name ? `, ${name}` : ""}`;
  if (hour < 17) return `Good afternoon${name ? `, ${name}` : ""}`;
  return `Good evening${name ? `, ${name}` : ""}`;
};

const makeId = () => {
  const cryptoApi = globalThis.crypto as Crypto & { randomUUID?: () => string } | undefined;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

function ChatContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const personaIds = PERSONAS.map((p) => p.id);
  const religionIds = RELIGIONS.map((r) => r.id);

  const maybePersona = searchParams.get("persona");
  const personaId: PersonaId = personaIds.includes(maybePersona as PersonaId)
    ? (maybePersona as PersonaId)
    : "raw";

  const maybeReligion = searchParams.get("religion");
  const religion: Religion | undefined = religionIds.includes(maybeReligion as Religion)
    ? (maybeReligion as Religion)
    : undefined;

  const persona = getPersonaById(personaId);
  const religionLabel = RELIGIONS.find((r) => r.id === religion)?.label;
  const initialPrompt = searchParams.get("q") ?? "";

  // Chat & Session State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => makeId());
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const [userName, setUserName] = useState<string>("");
  const [nameInput, setNameInput] = useState("");
  const [isNameDialogOpen, setIsNameDialogOpen] = useState(false);
  const [input, setInput] = useState<string>(initialPrompt);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [backendMissing, setBackendMissing] = useState<boolean>(() => !loadSettings().ollamaUrl);
  const initialPromptSentRef = useRef(false);

  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); // Dock Style Collapse
  const [isPersonaMenuOpen, setIsPersonaMenuOpen] = useState(false);
  const [aiMode, setAiMode] = useState<"fast" | "thinking">("fast");
  const [isMobile, setIsMobile] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof document === "undefined") return true;
    return document.documentElement.classList.contains("dark") || true;
  }); // Theme State

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamingIdRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // --- INITIALIZATION & RESPONSIVE FIXES ---
  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');

    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setIsSidebarOpen(false);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    const viewport = window.visualViewport;
    const adjustHeight = () => {
      if (viewport) {
        document.documentElement.style.setProperty('--vvp-height', `${viewport.height}px`);
      }
    };
    adjustHeight();
    viewport?.addEventListener('resize', adjustHeight);

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('resize', checkMobile);
      viewport?.removeEventListener('resize', adjustHeight);
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const saveCurrentSession = useCallback((finalMessages: ChatMessage[]) => {
    if (finalMessages.length < 2) return;

    setSessions((prev) => {
      const existingIdx = prev.findIndex(s => s.id === currentSessionId);
      const titleMatch = finalMessages.find(m => m.role === 'user')?.content || "New Chat";
      const title = titleMatch.length > 25 ? titleMatch.slice(0, 25) + "..." : titleMatch;

      const newSession: ChatSession = {
        id: currentSessionId,
        personaId,
        religion,
        title,
        updatedAt: Date.now(),
        messages: finalMessages
      };

      const updated = existingIdx >= 0
        ? prev.map((s, i) => i === existingIdx ? newSession : s)
        : [newSession, ...prev];

      const trimmed = updated.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 15);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      return trimmed;
    });
  }, [currentSessionId, personaId, religion]);

  const send = useCallback(async (forcedPrompt?: string) => {
    const trimmed = (forcedPrompt ?? input).trim();
    if (!trimmed || streaming) return;

    const settings = loadSettings();
    if (!settings.ollamaUrl) {
      setBackendMissing(true);
      setError("Connect your Ollama server in Settings before sending a message.");
      return;
    }

    setError("");
    if (forcedPrompt) setInput(trimmed);

    const userMsg: ChatMessage = {
      id: makeId(),
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
    };
    const assistantMsg: ChatMessage = {
      id: makeId(),
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    };

    streamingIdRef.current = assistantMsg.id;

    const nextMessages = [...messages, userMsg];
    setMessages([...nextMessages, assistantMsg]);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setIsPersonaMenuOpen(false);
    setStreaming(true);

    const usingCustomRawModel = personaId === "raw" && settings.rawModel.trim().length > 0;
    const model = usingCustomRawModel ? settings.rawModel.trim() : settings.model;
    const context = nextMessages.slice(-CONTEXT_WINDOW).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const ollamaMessages = usingCustomRawModel
      ? context
      : [{ role: "system", content: getSystemPrompt(personaId, religion) }, ...context];

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${settings.ollamaUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: ollamaMessages,
          stream: true,
          options: { temperature: 0.7, top_p: 0.92, repeat_penalty: 1.1 },
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error(`Ollama responded with ${res.status}.`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;
          try {
            const json = JSON.parse(trimmedLine);
            const chunk: string = json?.message?.content ?? "";
            if (chunk) {
              accumulated += chunk;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: accumulated } : m))
              );
            }
          } catch {
            // ignore incomplete stream chunks
          }
        }
      }

      const finalMessages = [...nextMessages, { ...assistantMsg, content: accumulated }];
      setMessages(finalMessages);
      saveCurrentSession(finalMessages);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError("Failed to get a response. Check your backend.");
      setMessages(nextMessages);
    } finally {
      setStreaming(false);
      streamingIdRef.current = null;
    }
  }, [input, messages, personaId, religion, streaming, saveCurrentSession]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedName = localStorage.getItem(USERNAME_STORAGE_KEY)?.trim();
    if (savedName) {
      setUserName(savedName);
      return;
    }

    setUserName("");
    setIsNameDialogOpen(true);
  }, []);

  const saveUserName = useCallback(() => {
    const nextName = nameInput.trim();
    if (!nextName) return;

    localStorage.setItem(USERNAME_STORAGE_KEY, nextName);
    setUserName(nextName);
    setNameInput("");
    setIsNameDialogOpen(false);
  }, [nameInput]);

  useEffect(() => {
    if (!initialPrompt || initialPromptSentRef.current) return;
    initialPromptSentRef.current = true;
    setInput(initialPrompt);
    void send(initialPrompt);
  }, [initialPrompt, send]);

  useEffect(() => {
    if (!initialPrompt || !initialPromptSentRef.current || !searchParams.get("q")) return;

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "assistant" || !lastMessage.content.trim()) return;

    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    const nextUrl = params.toString() ? `/rawmind/chat?${params.toString()}` : "/rawmind/chat";
    router.replace(nextUrl);
  }, [messages, initialPrompt, searchParams, router]);

  // --- THEME TOGGLE ---
  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const newTheme = !prev;
      if (newTheme) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return newTheme;
    });
  };

  // --- SESSION MANAGEMENT LOGIC ---
  const handleNewChat = useCallback(() => {
    setMessages([]);
    setCurrentSessionId(makeId());
    setError("");
    if (isMobile) setIsSidebarOpen(false);
  }, [isMobile]);

  const loadSession = useCallback((session: ChatSession) => {
    setMessages(session.messages);
    setCurrentSessionId(session.id);
    if (isMobile) setIsSidebarOpen(false);
  }, [isMobile]);

  // --- PERSONA SWITCH LOGIC ---
  const updateMode = useCallback(
    (nextPersona: PersonaId) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("persona", nextPersona);

      if (nextPersona === "oracle") {
        if (!params.get("religion")) {
          params.set("religion", RELIGIONS[0].id);
        }
      } else {
        params.delete("religion");
        setIsPersonaMenuOpen(false);
      }

      handleNewChat();
      router.replace(`/rawmind/chat?${params.toString()}`);
    },
    [router, searchParams, handleNewChat]
  );

  const updateReligion = useCallback(
    (nextReligion: Religion) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("persona", "oracle");
      params.set("religion", nextReligion);

      handleNewChat();
      router.replace(`/rawmind/chat?${params.toString()}`);
      setIsPersonaMenuOpen(false);
    },
    [router, searchParams, handleNewChat]
  );

  const activeSessions = sessions.filter(
    s => s.personaId === personaId && s.religion === religion
  );
  const greeting = getTimeGreeting(userName || undefined);

  return (
    <div
      className="flex w-full bg-[#f3f4f6] dark:bg-[#050505] text-slate-900 dark:text-white font-sans overflow-hidden relative transition-colors duration-300"
      style={{ height: 'var(--vvp-height, 100dvh)' }}
    >
      <AnimatePresence>
        {isNameDialogOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 20, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              className="w-[min(92vw,420px)] rounded-[28px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111111] p-6 shadow-2xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-amber-600 dark:text-amber-500 font-bold">Welcome</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">What should I call you?</h2>
                </div>
                <div className="rounded-full bg-amber-100 dark:bg-amber-500/10 p-3 text-amber-600 dark:text-amber-400">
                  <Brain size={22} />
                </div>
              </div>

              <p className="mb-5 text-sm text-slate-500 dark:text-gray-400">
                We’ll save your name on this device so the app can personalize your experience.
              </p>

              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-gray-300">
                Your name
              </label>
              <input
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveUserName();
                  }
                }}
                placeholder="Enter your name"
                className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1a1a1a] px-4 py-3 text-base text-slate-900 dark:text-white outline-none ring-0 placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:border-amber-400 dark:focus:border-amber-500"
              />

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    const fallback = "Friend";
                    localStorage.setItem(USERNAME_STORAGE_KEY, fallback);
                    setUserName(fallback);
                    setNameInput("");
                    setIsNameDialogOpen(false);
                  }}
                  className="rounded-xl border border-slate-200 dark:border-white/10 px-4 py-2 text-sm font-medium text-slate-600 dark:text-gray-300 transition hover:bg-slate-50 dark:hover:bg-white/5"
                >
                  Skip
                </button>
                <button
                  onClick={saveUserName}
                  disabled={!nameInput.trim()}
                  className="rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-800 dark:hover:bg-gray-200"
                >
                  Continue
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar Overlay for Mobile */}
      <AnimatePresence>
        {isMobile && isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      {/* Sidebar (Dock Style on Desktop, Drawer on Mobile) */}
      <AnimatePresence initial={false}>
        {isSidebarOpen && (
          <motion.div
            initial={isMobile ? { x: "-100%" } : { width: 0, opacity: 0, marginLeft: 0 }}
            animate={isMobile ? { x: 0 } : { width: isSidebarCollapsed ? 88 : 280, opacity: 1, marginLeft: 16 }}
            exit={isMobile ? { x: "-100%" } : { width: 0, opacity: 0, marginLeft: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className={`z-50 flex-shrink-0 flex flex-col bg-white dark:bg-[#0a0a0a] shadow-2xl transition-colors duration-300 ${isMobile
              ? "fixed h-full w-[280px] border-r border-slate-200 dark:border-white/5"
              : "relative h-[calc(100vh-32px)] my-4 rounded-[2rem] border border-slate-200 dark:border-white/5"
              }`}
          >
            {/* Logo & Top Navigation */}
            <div className={`p-4 flex items-center border-b border-slate-100 dark:border-white/5 ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
              {!isSidebarCollapsed ? (
                <>
                  <button onClick={() => router.push('/')} className="flex items-center gap-3 text-slate-900 dark:text-white hover:text-amber-500 transition-colors group">
                    <span className="text-amber-500 text-2xl font-serif group-hover:scale-105 transition-transform">🧠</span>
                    <span className="font-semibold tracking-widest text-sm">RAWMIND</span>
                  </button>
                  <div className="flex items-center gap-1">
                    {!isMobile && (
                      <button
                        onClick={() => setIsSidebarCollapsed(true)}
                        className="p-2 text-slate-400 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-all"
                        title="Collapse Sidebar"
                      >
                        <PanelLeftClose size={18} />
                      </button>
                    )}
                    {isMobile && (
                      <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="p-2 text-slate-400 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-all"
                      >
                        <X size={18} />
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <button
                  onClick={() => setIsSidebarCollapsed(false)}
                  className="p-2 text-slate-400 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-all flex flex-col items-center gap-2"
                  title="Expand Sidebar"
                >
                  <PanelLeft size={20} />
                </button>
              )}
            </div>

            {/* New Chat Button */}
            <div className="px-4 py-4">
              <button
                onClick={handleNewChat}
                className={`flex items-center justify-center py-3 bg-slate-900 dark:bg-[#111] hover:bg-slate-800 dark:hover:bg-white/10 border border-slate-800 dark:border-white/10 text-white rounded-xl transition-all font-medium text-sm group ${isSidebarCollapsed ? 'px-0 w-12 h-12 mx-auto rounded-2xl' : 'px-4 w-full justify-between'}`}
              >
                {isSidebarCollapsed ? (
                  <Plus size={20} className="text-white" />
                ) : (
                  <>
                    <span className="flex items-center gap-2">
                      <Plus size={16} className="text-slate-300 dark:text-gray-400 group-hover:text-white transition-colors" />
                      New Chat
                    </span>
                    <span className="text-lg opacity-80 group-hover:opacity-100 transition-opacity">✨</span>
                  </>
                )}
              </button>
            </div>

            {/* Recent Chats List */}
            <div className={`flex-1 overflow-y-auto space-y-1 no-scrollbar ${isSidebarCollapsed ? 'px-2' : 'px-3'} py-1`}>
              {!isSidebarCollapsed && (
                <div className="px-3 py-2 text-[11px] font-bold text-slate-400 dark:text-gray-500/70 uppercase tracking-wider">
                  Recent Chats
                </div>
              )}

              {activeSessions.length === 0 ? (
                !isSidebarCollapsed && (
                  <div className="px-3 py-6 text-sm text-slate-500 dark:text-gray-500 text-center border border-dashed border-slate-200 dark:border-white/5 rounded-xl mx-2">
                    No recent chats
                  </div>
                )
              ) : (
                activeSessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => loadSession(s)}
                    title={isSidebarCollapsed ? s.title : undefined}
                    className={`flex items-center text-left transition-all ${isSidebarCollapsed
                      ? "justify-center w-12 h-12 mx-auto rounded-2xl mb-2"
                      : "w-full gap-3 px-3 py-2.5 rounded-xl text-sm"
                      } ${currentSessionId === s.id
                        ? "bg-slate-100 dark:bg-[#1a1a1a] text-slate-900 dark:text-white border border-slate-200 dark:border-white/5 shadow-sm"
                        : "text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white border border-transparent"
                      }`}
                  >
                    <MessageSquare size={16} className={`shrink-0 ${currentSessionId === s.id ? "text-amber-500" : ""}`} />
                    {!isSidebarCollapsed && <span className="truncate flex-1 leading-relaxed">{s.title}</span>}
                  </button>
                ))
              )}
            </div>

            {/* User Profile & Settings Area */}
            <div className="p-3 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-[#080808] transition-colors duration-300">
              <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center flex-col gap-3' : 'justify-between'} p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-white/5 transition-colors cursor-pointer group`}>
                <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-400 to-amber-600 p-[2px] shrink-0">
                    <div className="w-full h-full rounded-full bg-slate-900 dark:bg-black overflow-hidden border-2 border-slate-900 dark:border-black">
                      <img src="/FC-Logo.png" alt={userName || "User"} className="w-full h-full object-cover" />
                    </div>
                  </div>
                  {!isSidebarCollapsed && (
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium text-slate-900 dark:text-gray-200 truncate">{userName || "Friend"}</span>
                      <span className="text-[10px] text-amber-600 dark:text-amber-500 font-bold tracking-widest mt-0.5">PRO</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => router.push('/rawmind/settings')}
                  className={`p-2 text-slate-400 dark:text-gray-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors rounded-lg hover:bg-white dark:hover:bg-white/10 shrink-0 ${isSidebarCollapsed ? 'mt-1' : ''}`}
                  title="Settings"
                >
                  <Settings size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
      <div className="flex-1  flex flex-col min-w-0 relative">
        {/* Header */}
        <div className="flex items-center justify-center px-4 md:px-6 py-4 shrink-0 absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-[#f3f4f6] via-[#f3f4f6]/90 dark:from-[#050505] dark:via-[#050505]/90 to-transparent pointer-events-none transition-colors duration-300">
          <div className="flex items-center gap-4 pointer-events-auto">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 -ml-2 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <Menu size={20} />
              </button>
            )}
          </div>

          <div className="flex items-center justify-center gap-2 px-4 py-1.5 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111] shadow-md dark:shadow-lg backdrop-blur-md pointer-events-auto transition-colors duration-300">
            <span className="text-amber-500">✨</span>
            <span className="text-sm font-medium text-slate-800 dark:text-gray-200">RawMind {religionLabel ? `· ${religionLabel}` : ''}</span>
          </div>

          {/* <div className="flex items-center gap-3 pointer-events-auto"> */}
          {/* <button className="hidden md:flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/30 text-amber-600 dark:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors text-sm font-medium">
              <Crown size={16} />
              Upgrade
            </button> */}
          {/* Working Theme Toggle Button */}
          {/* <button
              onClick={toggleTheme}
              className="p-2 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-transparent text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/10 transition-colors shadow-sm dark:shadow-none"
              title="Toggle Theme"
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button> */}
          {/* </div> */}
        </div>

        {/* Chat Feed */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar px-4 pt-24 pb-4 flex flex-col">
          <div className="max-w-3xl mx-auto w-full flex flex-col justify-end flex-1">

            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center flex-1 mb-12 mt-12">
                <h1 className="text-4xl md:text-5xl tracking-tight text-slate-800 dark:text-white mb-2">
                  {greeting.split(",")[0]}
                </h1>
                <h1 className="text-4xl md:text-5xl font-serif text-amber-600 dark:text-amber-500 tracking-tight mb-8">
                  {userName || "Friend"}
                </h1>
                <p className="text-slate-500 dark:text-gray-400 text-lg mb-8 text-center px-4">What can I help you with today?</p>
              </div>
            )}

            <div className="flex flex-col gap-6">
              {messages.map((m) => (
                <div key={m.id} className={`flex w-full flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                  <div
                    className={`flex flex-col relative px-5 py-4 text-[15px] leading-relaxed max-w-[90%] md:max-w-[85%] ${m.role === "user"
                      ? "bg-slate-900 dark:bg-[#1e1e1e] text-white dark:text-gray-200 rounded-3xl shadow-sm"
                      : "bg-transparent text-slate-800 dark:text-gray-200"
                      }`}
                  >
                    {m.content ? (
                      m.role === "assistant" ? (
                        <div className="prose dark:prose-invert prose-slate prose-p:leading-relaxed max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      )
                    ) : (
                      <div className="flex items-center gap-1.5 h-6">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"
                            style={{ animationDelay: `${i * 0.15}s` }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {error && (
              <div className="mt-4 text-center text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-400/10 border border-red-200 dark:border-red-400/20 rounded-xl px-4 py-3">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Floating Dock Style Input Area */}
        <div className="shrink-0 px-4 pb-6 pt-2 w-full flex justify-center">
          <div className="w-full max-w-3xl relative">

            {/* Smooth Slide-up Persona Menu */}
            <AnimatePresence>
              {isPersonaMenuOpen && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsPersonaMenuOpen(false)}
                    className={`fixed inset-0 z-40 touch-none ${isMobile ? "bg-black/60 backdrop-blur-sm" : "bg-transparent"}`}
                  />

                  <motion.div
                    initial={isMobile ? { y: "100%" } : { opacity: 0, y: 15, scale: 0.98 }}
                    animate={isMobile ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
                    exit={isMobile ? { y: "100%" } : { opacity: 0, y: 15, scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    className={`z-50 bg-white dark:bg-[#171717] flex flex-col gap-1 overflow-y-auto no-scrollbar shadow-2xl transition-colors duration-300 ${isMobile
                      ? "fixed inset-x-0 bottom-0 rounded-t-[32px] p-5 pb-8 max-h-[85vh] border-t border-slate-200 dark:border-white/10"
                      : "absolute bottom-full mb-4 left-0 w-[340px] rounded-[1.5rem] p-3 max-h-[60vh] border border-slate-200 dark:border-white/5"
                      }`}
                  >
                    {isMobile && (
                      <div className="w-12 h-1.5 bg-slate-300 dark:bg-white/20 rounded-full mx-auto mb-4 shrink-0" />
                    )}

                    <p className="text-xs text-slate-500 dark:text-gray-500 uppercase tracking-wider px-3 py-2 pb-1 font-bold">Select Persona</p>
                    {PERSONAS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => updateMode(p.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors shrink-0 ${personaId === p.id
                          ? "bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white"
                          : "text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
                          }`}
                      >
                        <span className="text-xl w-6 text-center">{p.icon}</span>
                        <span className="font-medium">{p.name}</span>
                      </button>
                    ))}

                    {/* Dynamic Religion Grid */}
                    <AnimatePresence>
                      {personaId === "oracle" && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden shrink-0 mt-1"
                        >
                          <div className="h-px bg-slate-100 dark:bg-white/10 my-3 mx-2" />
                          <p className="text-xs text-amber-600 dark:text-amber-500/70 uppercase tracking-wider px-3 py-2 pb-3 font-bold">Select Belief System</p>

                          <div className="grid grid-cols-2 gap-2 px-1 pb-2">
                            {RELIGIONS.map((r) => (
                              <button
                                key={r.id}
                                onClick={() => updateReligion(r.id)}
                                className={`flex items-center gap-2 px-3 py-3 rounded-xl text-sm transition-all font-medium ${religion === r.id
                                  ? "bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-500 border border-amber-200 dark:border-amber-500/30 shadow-sm dark:shadow-inner"
                                  : "bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white border border-transparent"
                                  }`}
                              >
                                <span className="text-lg w-5 text-center">{r.icon}</span>
                                <span>{r.label}</span>
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            <div className="flex flex-col bg-white dark:bg-[#111111] rounded-[28px] md:rounded-[32px] p-3 border border-slate-200 dark:border-white/10 z-30 relative shadow-xl dark:shadow-2xl transition-colors duration-300">
              <div className="flex items-start gap-2 px-3 pb-2">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  placeholder="Ask anything privately..."
                  className="flex-1 bg-transparent text-slate-900 dark:text-gray-200 outline-none resize-none pt-3 text-[15px] no-scrollbar min-h-[44px] max-h-[150px] placeholder:text-slate-400 dark:placeholder:text-gray-600"
                />

                <button
                  onClick={() => void send()}
                  disabled={!input.trim() || streaming}
                  className={`p-3 rounded-2xl transition-all self-end shrink-0 mb-1
                    ${input.trim() && !streaming
                      ? "bg-slate-900 dark:bg-white/20 text-white hover:bg-slate-800 dark:hover:bg-white/30 shadow-md"
                      : "bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-gray-600"}`}
                >
                  {streaming ? <Loader2 size={20} className="animate-spin" /> : <ArrowUp size={20} />}
                </button>
              </div>

              <div className="flex items-center justify-between mt-1 px-1">
                <div className="flex items-center gap-2">
                  <button onClick={handleNewChat} className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-white/5 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/10 transition-colors" title="New Chat">
                    <Plus size={20} />
                  </button>
                  <button
                    onClick={() => setIsPersonaMenuOpen(true)}
                    className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${isPersonaMenuOpen ? "bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white" : "text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/10"
                      }`}
                  >
                    <SlidersHorizontal size={18} />
                  </button>
                </div>

                <div className="flex items-center bg-slate-50 dark:bg-[#1a1a1a] rounded-2xl p-1 border border-slate-200 dark:border-white/5 transition-colors duration-300">
                  <button
                    onClick={() => setAiMode("fast")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${aiMode === "fast" ? "text-amber-600 dark:text-amber-400 bg-white dark:bg-white/5 shadow-sm" : "text-slate-500 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-300"
                      }`}
                  >
                    <Zap size={16} className={aiMode === "fast" ? "fill-amber-600 dark:fill-amber-400" : ""} /> Fast
                  </button>
                  <button
                    onClick={() => setAiMode("thinking")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${aiMode === "thinking" ? "bg-[#d67a7a] text-white dark:text-black shadow-sm" : "text-slate-500 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-300"
                      }`}
                  >
                    <Brain size={16} className={aiMode === "thinking" ? "fill-white dark:fill-black" : ""} /> Thinking
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function RawMindChatPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f3f4f6] dark:bg-[#050505]" />}>
      <ChatContent />
    </Suspense>
  );
}