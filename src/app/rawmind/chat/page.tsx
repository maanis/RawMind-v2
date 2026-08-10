"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUp, Settings as SettingsIcon, Sparkles, ServerCrash,
  ChevronDown, Mic, Plus, MessageSquare, Search, PanelLeft, Code,
  Terminal, ChevronLeft
} from "lucide-react";
import { PERSONAS, RELIGIONS, Religion } from "@/lib/rawmind/personas";
import { loadSettings } from "@/lib/rawmind/storage";

export default function RawMindHome() {
  const router = useRouter();
  const [intent, setIntent] = useState("");
  const [hasBackend, setHasBackend] = useState<boolean | null>(null);
  const [selectedPersona, setSelectedPersona] = useState(PERSONAS[0]);
  const [selectedReligion, setSelectedReligion] = useState<Religion | null>(null);

  // Dropdown states
  const [showDropdown, setShowDropdown] = useState(false);
  const [showReligionView, setShowReligionView] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasBackend(Boolean(loadSettings().ollamaUrl));
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [intent]);

  const handleStartChat = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!intent.trim() && !selectedPersona) return;

    const params = new URLSearchParams({ persona: selectedPersona.id });
    if (selectedReligion) params.set("religion", selectedReligion);
    if (intent.trim()) params.set("q", intent.trim()); // Pass initial prompt to chat

    router.push(`/rawmind/chat?${params.toString()}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleStartChat();
    }
  };

  return (
    <div className="flex h-[100dvh] w-full bg-[#09090b] text-zinc-100 overflow-hidden font-sans selection:bg-indigo-500/30 selection:text-white">

      {/* 1. Claude-Style Sidebar (Desktop) */}
      <aside className="hidden md:flex flex-col w-[260px] h-full bg-[#09090b] border-r border-white/5 flex-shrink-0">
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 px-2 text-zinc-200 hover:text-white transition-colors cursor-pointer">
            <Sparkles size={18} className="text-indigo-400" />
            <span className="font-serif text-lg tracking-wide">RawMind</span>
          </div>
          <button className="p-1.5 text-zinc-500 hover:text-white transition-colors rounded-md hover:bg-white/5">
            <PanelLeft size={18} />
          </button>
        </div>

        <div className="px-3 mt-2 space-y-0.5 flex-1 overflow-y-auto">
          <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5 rounded-lg transition-colors group">
            <Plus size={16} className="text-zinc-500 group-hover:text-white transition-colors" />
            New Chat
          </button>

          <div className="pt-6 pb-2 px-3 text-[10px] uppercase tracking-widest text-zinc-600 font-bold">
            Recents
          </div>
          <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-400 hover:bg-white/5 hover:text-zinc-200 rounded-lg transition-colors truncate">
            <MessageSquare size={14} className="flex-shrink-0 opacity-50" />
            <span className="truncate">Existence and simulation</span>
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-400 hover:bg-white/5 hover:text-zinc-200 rounded-lg transition-colors truncate">
            <MessageSquare size={14} className="flex-shrink-0 opacity-50" />
            <span className="truncate">Analyzing deep work states</span>
          </button>

          <div className="pt-6 pb-2 px-3 text-[10px] uppercase tracking-widest text-zinc-600 font-bold">
            System
          </div>
          <button
            onClick={() => router.push("/rawmind/settings")}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-400 hover:bg-white/5 hover:text-zinc-200 rounded-lg transition-colors"
          >
            <Terminal size={14} className="flex-shrink-0 opacity-50" />
            Local Models
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-400 hover:bg-white/5 hover:text-zinc-200 rounded-lg transition-colors">
            <Code size={14} className="flex-shrink-0 opacity-50" />
            API Config
          </button>
        </div>

        {/* User Profile Footer (Styled like Claude's bottom left profile) */}
        <div className="p-3 border-t border-white/5">
          <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-xs border border-indigo-500/30">
                MJ
              </div>
              <div className="flex flex-col items-start">
                <span className="text-sm font-semibold text-zinc-200">Manish Jha</span>
                <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Local Mode</span>
              </div>
            </div>
            <SettingsIcon size={14} className="text-zinc-500" />
          </button>
        </div>
      </aside>

      {/* 2. Main Chat Interface */}
      <main className="flex-1 flex flex-col relative h-[100dvh]">

        {/* MindScroll Ambient Glow */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.15, 0.1] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] bg-indigo-500/20 blur-[120px] rounded-full"
          />
        </div>

        {/* Top Nav (Mobile & Small screens) */}
        <header className="flex md:hidden items-center justify-between p-4 z-10 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-md">
          <div className="flex items-center gap-2 text-zinc-200">
            <Sparkles size={16} className="text-indigo-400" />
            <span className="font-serif text-lg tracking-wide">RawMind</span>
          </div>
          <button onClick={() => router.push("/rawmind/settings")} className="p-2 text-zinc-400 hover:text-white">
            <SettingsIcon size={18} />
          </button>
        </header>

        {/* Center Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 z-10 w-full max-w-3xl mx-auto mt-[-5vh]">

          {/* Claude-style Big Serif Greeting */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center flex flex-col items-center gap-4 mb-8 md:mb-12"
          >
            <h1 className="font-serif text-4xl md:text-5xl text-white tracking-tight flex items-center gap-3">
              <Sparkles className="text-indigo-400/80" size={32} />
              An unfiltered mind.
            </h1>
          </motion.div>

          {/* Master Input Box (Combines MindScroll Glassmorphism with Claude structure) */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="w-full relative"
          >
            <form
              onSubmit={handleStartChat}
              className="group relative flex flex-col w-full bg-[#111113]/80 backdrop-blur-3xl border border-white/10 rounded-2xl md:rounded-[2rem] transition-all duration-300 focus-within:border-indigo-500/40 focus-within:bg-[#111113]/95 shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-visible"
            >
              <textarea
                ref={textareaRef}
                rows={1}
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="What do you want to explore?"
                className="w-full bg-transparent text-zinc-100 placeholder:text-zinc-600 px-5 pt-6 pb-2 md:px-6 md:pt-7 outline-none text-base md:text-lg resize-none overflow-y-auto no-scrollbar min-h-[90px] md:min-h-[120px] transition-all"
              />

              {/* Bottom Toolbar inside Input */}
              <div className="flex items-center justify-between px-3 pb-3 pt-2">

                {/* Left side: Persona Selector */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
                  >
                    <span className="text-indigo-400">{selectedPersona.icon}</span>
                    <span>{selectedPersona.name}</span>
                    {selectedReligion && <span className="text-zinc-500 ml-1">· {selectedReligion}</span>}
                    <ChevronDown size={14} className="ml-1 opacity-50" />
                  </button>

                  {/* Dropdown Menu (Framer Motion) */}
                  <AnimatePresence>
                    {showDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute bottom-full left-0 mb-2 w-64 bg-[#18181b] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col"
                      >
                        {!showReligionView ? (
                          <>
                            <div className="px-3 py-2 border-b border-white/5 text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                              Select Persona
                            </div>
                            <div className="max-h-64 overflow-y-auto no-scrollbar p-1">
                              {PERSONAS.map(p => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => {
                                    if (p.hasSubOptions) {
                                      setSelectedPersona(p);
                                      setShowReligionView(true);
                                    } else {
                                      setSelectedPersona(p);
                                      setSelectedReligion(null);
                                      setShowDropdown(false);
                                    }
                                  }}
                                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${selectedPersona.id === p.id ? 'bg-indigo-500/10 text-indigo-300' : 'text-zinc-300 hover:bg-white/5'}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span>{p.icon}</span>
                                    <span>{p.name}</span>
                                  </div>
                                  {p.hasSubOptions && <ChevronRight size={14} className="opacity-50" />}
                                </button>
                              ))}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 px-2 py-2 border-b border-white/5 text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                              <button
                                type="button"
                                onClick={() => setShowReligionView(false)}
                                className="p-1 hover:bg-white/10 rounded"
                              >
                                <ChevronLeft size={14} />
                              </button>
                              Select Philosophy
                            </div>
                            <div className="max-h-64 overflow-y-auto no-scrollbar p-1">
                              {RELIGIONS.map(r => (
                                <button
                                  key={r.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedReligion(r.id);
                                    setShowDropdown(false);
                                    setShowReligionView(false);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-left text-zinc-300 hover:bg-white/5 transition-colors"
                                >
                                  <span>{r.icon}</span>
                                  <span>{r.label}</span>
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Right side: Mic & Send */}
                <div className="flex items-center gap-1 md:gap-2">
                  <button type="button" className="p-2.5 text-zinc-500 hover:text-zinc-200 hover:bg-white/5 rounded-xl transition-colors">
                    <Mic size={18} />
                  </button>
                  <button
                    type="submit"
                    className="p-2.5 bg-white text-black rounded-xl hover:bg-zinc-200 transition-all shadow-md active:scale-95 disabled:opacity-30 disabled:hover:bg-white"
                  >
                    <ArrowUp size={18} className="stroke-[2.5]" />
                  </button>
                </div>

              </div>

              {/* Status Footer inside the box (Like Claude's message limit) */}
              {hasBackend === false ? (
                <div className="w-full flex items-center justify-between px-5 py-3 bg-rose-500/10 border-t border-rose-500/20 text-xs text-rose-300">
                  <span>No local model detected.</span>
                  <button type="button" onClick={() => router.push("/rawmind/settings")} className="font-semibold underline underline-offset-2 hover:text-rose-100">Configure</button>
                </div>
              ) : (
                <div className="w-full px-5 py-2.5 bg-white/[0.02] border-t border-white/5 text-[10px] text-zinc-500 text-center md:text-left">
                  Responses run locally. Privacy maintained.
                </div>
              )}
            </form>
          </motion.div>
        </div>
      </main>
    </div>
  );
}