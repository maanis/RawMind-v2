"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Settings as SettingsIcon } from "lucide-react";
import { PERSONAS, RELIGIONS, Religion } from "@/lib/rawmind/personas";
import { loadSettings } from "@/lib/rawmind/storage";

export default function RawMindHome() {
  const router = useRouter();
  const [religionPicker, setReligionPicker] = useState(false);
  const [hasBackend, setHasBackend] = useState<boolean | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading localStorage, client-only
    setHasBackend(Boolean(loadSettings().ollamaUrl));
  }, []);

  const openChat = (personaId: string, religion?: Religion) => {
    const params = new URLSearchParams({ persona: personaId });
    if (religion) params.set("religion", religion);
    router.push(`/rawmind/chat?${params.toString()}`);
  };

  return (
    <div className="min-h-screen px-6 py-10 md:py-16 max-w-2xl mx-auto vignette">
      <div className="space-y-2 mb-10">
        <p className="text-[10px] tracking-[0.35em] uppercase text-[var(--muted)]">Unfiltered by design</p>
        <h1 className="font-display text-3xl md:text-4xl tracking-tight">RawMind</h1>
        <p className="text-sm text-[var(--muted)] max-w-md">
          Pick a persona to talk to. Responses come from a model running on your own machine — nothing is sent to us.
        </p>
      </div>

      {hasBackend === false && (
        <button
          onClick={() => router.push("/rawmind/settings")}
          className="w-full mb-8 flex items-center justify-between gap-3 card-surface rounded-2xl px-5 py-4 text-left hover:border-white/20 transition-colors"
        >
          <div className="flex items-center gap-3">
            <SettingsIcon size={18} className="accent-text shrink-0" />
            <div>
              <p className="text-sm font-medium">Connect your own model first</p>
              <p className="text-xs text-[var(--muted)]">Set up Ollama and paste its URL to start chatting</p>
            </div>
          </div>
          <ArrowRight size={16} className="text-[var(--muted)] shrink-0" />
        </button>
      )}

      <div className="grid gap-3">
        {PERSONAS.map((persona, idx) => (
          <motion.button
            key={persona.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => {
              if (persona.hasSubOptions) {
                setReligionPicker((v) => !v);
              } else {
                openChat(persona.id);
              }
            }}
            className="group text-left card-surface rounded-2xl p-5 hover:border-white/20 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="text-xl accent-text w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--accent-soft)] shrink-0">
                  {persona.icon}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)] mb-1">{persona.label}</p>
                  <p className="font-display text-lg tracking-tight">{persona.name}</p>
                  <p className="text-sm text-[var(--muted)] mt-1 leading-snug">{persona.description}</p>
                </div>
              </div>
              <ArrowRight size={16} className="text-[var(--muted)] group-hover:text-[var(--foreground)] group-hover:translate-x-0.5 transition-all shrink-0 mt-2" />
            </div>

            {persona.hasSubOptions && religionPicker && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-4 pt-4 border-t border-[var(--border)] grid grid-cols-2 sm:grid-cols-3 gap-2"
              >
                {RELIGIONS.map((r) => (
                  <button
                    key={r.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      openChat("oracle", r.id);
                    }}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-[var(--border)] hover:border-white/20 text-sm transition-colors"
                  >
                    <span>{r.icon}</span>
                    <span>{r.label}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
