"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Settings as SettingsIcon, Sparkles, ServerCrash, ChevronRight } from "lucide-react";
import ProgressLock from "@/components/ProgressLock";
import { PERSONAS, RELIGIONS, Religion } from "@/lib/rawmind/personas";
import { loadSettings } from "@/lib/rawmind/storage";

export default function RawMindHome() {
  const router = useRouter();
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [hasBackend, setHasBackend] = useState<boolean | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasBackend(Boolean(loadSettings().ollamaUrl));
  }, []);

  const openChat = (personaId: string, religion?: Religion) => {
    const params = new URLSearchParams({ persona: personaId });
    if (religion) params.set("religion", religion);
    router.push(`/rawmind/chat?${params.toString()}`);
  };

  return (
    <ProgressLock>
      <main className="relative flex min-h-screen flex-col items-center justify-center p-6 bg-[#09090b] text-zinc-100 overflow-hidden font-sans selection:bg-indigo-500/30 selection:text-white">

        {/* Soft Ambient Background */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <motion.div
            animate={{ scale: [1, 1.05, 1], opacity: [0.15, 0.2, 0.15] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70vw] h-[70vw] bg-indigo-500/10 blur-[100px] rounded-full"
          />
        </div>

        <div className="z-10 w-full max-w-3xl flex flex-col items-center space-y-10 mt-[-5vh]">

          {/* Claude-style Serif Greeting */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-center space-y-4"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-zinc-400 backdrop-blur-md mb-2">
              <Sparkles size={14} className="text-indigo-400" />
              <span>Local AI Environment</span>
            </div>
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-white tracking-tight leading-tight">
              An unfiltered mind.
            </h1>
          </motion.div>

          {/* Centralized Command Console */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="w-full flex flex-col bg-[#111113]/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Missing Backend Warning Header */}
            {hasBackend === false && (
              <div className="flex items-center justify-between gap-4 px-6 py-4 bg-rose-500/10 border-b border-rose-500/20">
                <div className="flex items-center gap-3 text-rose-400">
                  <ServerCrash size={18} />
                  <span className="text-sm font-medium">Local model disconnected</span>
                </div>
                <button
                  onClick={() => router.push("/rawmind/settings")}
                  className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-rose-300 hover:text-white transition-colors"
                >
                  <SettingsIcon size={14} />
                  Configure
                </button>
              </div>
            )}

            <div className="p-2">
              <div className="px-4 py-3 border-b border-white/5 mb-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                  Initialize Persona
                </span>
              </div>

              {/* Single-Column Persona List */}
              <div className="flex flex-col gap-1">
                {PERSONAS.map((persona) => {
                  const isSelected = selectedPersona === persona.id;

                  return (
                    <div key={persona.id} className="flex flex-col">
                      <button
                        onClick={() => {
                          if (persona.hasSubOptions) {
                            setSelectedPersona(isSelected ? null : persona.id);
                          } else {
                            openChat(persona.id);
                          }
                        }}
                        className={`flex items-center justify-between px-4 py-4 rounded-xl transition-all duration-200 text-left ${isSelected ? "bg-white/10" : "hover:bg-white/5"
                          }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-xl text-zinc-300">
                            {persona.icon}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-base font-semibold text-zinc-100">
                              {persona.name}
                            </span>
                            <span className="text-sm text-zinc-500">
                              {persona.description}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center text-zinc-500">
                          {persona.hasSubOptions ? (
                            <motion.div
                              animate={{ rotate: isSelected ? 90 : 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <ChevronRight size={18} />
                            </motion.div>
                          ) : (
                            <ArrowRight size={18} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </div>
                      </button>

                      {/* Expandable Sub-options (Single Column Alignment) */}
                      <AnimatePresence>
                        {persona.hasSubOptions && isSelected && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="flex flex-col gap-1 px-4 py-3 ml-12 border-l border-white/10 my-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2 pl-2">
                                Select Base Philosophy
                              </span>
                              {RELIGIONS.map((r) => (
                                <button
                                  key={r.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openChat("oracle", r.id);
                                  }}
                                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 text-sm transition-colors text-left"
                                >
                                  <span className="text-zinc-400">{r.icon}</span>
                                  <span className="text-zinc-300 font-medium">{r.label}</span>
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </ProgressLock>
  );
}