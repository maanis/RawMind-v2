"use client";

import { motion } from "framer-motion";
import { Brain, Heart, Layers, Radio } from "lucide-react";

interface InsightBarProps {
  topicAffinities: Record<string, number>;
  channelAffinities: Record<string, number>;
  totalLikes: number;
  totalSignals: number;
  isOpen: boolean;
  onToggle: () => void;
}

function topEntries(map: Record<string, number>, limit = 3) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

export default function InsightBar({
  topicAffinities,
  channelAffinities,
  totalLikes,
  totalSignals,
  isOpen,
  onToggle,
}: InsightBarProps) {
  const topTopics = topEntries(topicAffinities);
  const topChannels = topEntries(channelAffinities);

  return (
    <motion.div
      initial={{ y: 120, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed bottom-4 inset-x-0 z-[70] px-4 md:px-6"
    >
      <div className="mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-black/80 shadow-2xl backdrop-blur-xl">
        <button
          onClick={onToggle}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-zinc-300">
            <Brain size={14} className="text-[var(--accent)]" />
            <span>Insight Bar</span>
          </div>
          <div className="text-[10px] text-zinc-400">{isOpen ? "Tap to collapse" : "Tap to expand"}</div>
        </button>

        {isOpen ? (
          <div className="grid gap-3 border-t border-white/10 p-4 md:grid-cols-2">
            <div className="rounded-xl bg-white/5 p-3">
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-400">
                <Layers size={12} />
                <span>Top Topics</span>
              </div>
              <div className="space-y-1 text-sm text-zinc-200">
                {topTopics.length ? topTopics.map(([topic, score]) => (
                  <div key={topic} className="flex justify-between">
                    <span>{topic}</span>
                    <span className="text-zinc-400">{score.toFixed(2)}</span>
                  </div>
                )) : <div className="text-zinc-500">No topic signals yet</div>}
              </div>
            </div>

            <div className="rounded-xl bg-white/5 p-3">
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-400">
                <Radio size={12} />
                <span>Top Channels</span>
              </div>
              <div className="space-y-1 text-sm text-zinc-200">
                {topChannels.length ? topChannels.map(([channel, score]) => (
                  <div key={channel} className="flex justify-between">
                    <span>{channel}</span>
                    <span className="text-zinc-400">{score.toFixed(2)}</span>
                  </div>
                )) : <div className="text-zinc-500">No channel signals yet</div>}
              </div>
            </div>

            <div className="md:col-span-2 flex gap-3">
              <div className="flex-1 rounded-xl bg-white/5 p-3 text-center">
                <div className="text-[10px] uppercase tracking-wider text-zinc-400">Signals</div>
                <div className="text-lg font-bold text-white">{totalSignals}</div>
              </div>
              <div className="flex-1 rounded-xl bg-white/5 p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-zinc-400">
                  <Heart size={10} className="text-[var(--accent)]" />
                  <span>Likes</span>
                </div>
                <div className="text-lg font-bold text-white">{totalLikes}</div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
