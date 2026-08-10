"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Brain, Heart, Layers, Radio, Activity, ChevronUp, X } from "lucide-react";

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
    <div className="fixed bottom-6 inset-x-0 z-[70] px-4 flex justify-center pointer-events-none">

      <AnimatePresence mode="wait">
        {!isOpen ? (
          // The Minimal Floating Pill (Closed State)
          <motion.button
            key="pill"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.9 }}
            onClick={onToggle}
            className="pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.5)] hover:bg-white/10 transition-colors"
          >
            <Brain size={16} className="text-indigo-400" />
            <span className="text-xs font-semibold uppercase tracking-widest text-white/90">Profile Data</span>
            <ChevronUp size={14} className="text-white/40 ml-1" />
          </motion.button>
        ) : (
          // The Expanded Bento Dashboard
          <motion.div
            key="dashboard"
            layoutId="insight-container"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            className="pointer-events-auto w-full max-w-xl bg-[#111113]/90 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-5 md:p-6 shadow-[0_30px_60px_rgba(0,0,0,0.6)] overflow-hidden"
          >
            <div className="flex items-center justify-between mb-6 px-2">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-500/20 rounded-lg">
                  <Brain size={18} className="text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">Learned Profile</h3>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest">Real-time analysis</p>
                </div>
              </div>
              <button
                onClick={onToggle}
                className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/60 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 md:gap-4">

              {/* Topics Bento */}
              <div className="col-span-2 md:col-span-1 bg-white/[0.03] border border-white/5 rounded-3xl p-5 hover:bg-white/[0.05] transition-colors">
                <div className="flex items-center gap-2 mb-4 text-white/50">
                  <Layers size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Top Topics</span>
                </div>
                <div className="space-y-3">
                  {topTopics.length ? topTopics.map(([topic, score]) => (
                    <div key={topic} className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-end">
                        <span className="text-xs font-medium text-white/90 truncate pr-2">{topic}</span>
                        <span className="text-[10px] font-mono text-indigo-400">{(score * 100).toFixed(0)}</span>
                      </div>
                      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500/50" style={{ width: `${Math.min(score * 100, 100)}%` }} />
                      </div>
                    </div>
                  )) : <div className="text-xs text-white/30 italic">Observing behavior...</div>}
                </div>
              </div>

              {/* Channels Bento */}
              <div className="col-span-2 md:col-span-1 bg-white/[0.03] border border-white/5 rounded-3xl p-5 hover:bg-white/[0.05] transition-colors">
                <div className="flex items-center gap-2 mb-4 text-white/50">
                  <Radio size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Affinities</span>
                </div>
                <div className="space-y-3">
                  {topChannels.length ? topChannels.map(([channel, score]) => (
                    <div key={channel} className="flex justify-between items-center bg-white/5 px-3 py-2 rounded-xl">
                      <span className="text-xs font-medium text-white/90 truncate pr-2">{channel}</span>
                      <span className="text-[10px] font-mono bg-white/10 px-2 py-0.5 rounded text-white/60">
                        {(score * 10).toFixed(1)}
                      </span>
                    </div>
                  )) : <div className="text-xs text-white/30 italic">No channel data yet</div>}
                </div>
              </div>

              {/* Metrics Row */}
              <div className="col-span-2 grid grid-cols-2 gap-3">
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Interactions</span>
                    <span className="text-xl font-bold text-white">{totalSignals}</span>
                  </div>
                  <Activity size={24} className="text-white/10" />
                </div>
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-rose-400/60">Saves/Likes</span>
                    <span className="text-xl font-bold text-rose-400">{totalLikes}</span>
                  </div>
                  <Heart size={24} className="text-rose-500/20" fill="currentColor" />
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}