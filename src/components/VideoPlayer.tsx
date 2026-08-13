"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Info, Heart, ChevronDown, Sparkles, Activity, Target } from "lucide-react";
import { IntentProfile } from "@/lib/feed/types";

interface Video {
  id: string;
  title: string;
  channelTitle: string;
  reason: string;
  originalQuery?: string;
}

interface VideoPlayerProps {
  video: Video;
  isActive: boolean;
  onSignal: (videoId: string, type: 'watchTime' | 'like', value: number | boolean) => void;
  intentProfile: IntentProfile | null;
}

export default function VideoPlayer({ video, isActive, onSignal, intentProfile }: VideoPlayerProps) {
  const [showInsight, setShowInsight] = useState(false);
  const [liked, setLiked] = useState(false);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (isActive) {
      startTimeRef.current = Date.now();
      return;
    }

    if (startTimeRef.current) {
      const duration = (Date.now() - startTimeRef.current) / 1000;
      onSignal(video.id, 'watchTime', duration);
      startTimeRef.current = null;
    }
  }, [isActive, video.id, onSignal]);

  const toggleLike = () => {
    setLiked(!liked);
    onSignal(video.id, 'like', !liked);
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden selection:bg-white/20 selection:text-white">

      {/* Video Content */}
      <div className="absolute inset-0 z-0 bg-black flex items-center justify-center overflow-hidden">
        {isActive ? (
          <iframe
            key={`mount-v-${video.id}`}
            className="pointer-events-none md:pointer-events-auto"
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: "100%",
              height: "100%",
              transform: "translate(-50%, -50%) scale(1.18)",
              transformOrigin: "center",
              border: 0,
            }}
            src={`https://www.youtube.com/embed/${video.id}?autoplay=1&controls=0&modestbranding=1&rel=0&loop=1&playlist=${video.id}&showinfo=0&iv_load_policy=3&disablekb=1&enablejsapi=1&origin=${typeof window !== 'undefined' ? window.location.origin : ''}`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        ) : null}
      </div>

      {/* Cinematic Gradient Overlays */}
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none z-10" />
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent pointer-events-none z-10" />

      {/* Floating Action Rails */}
      <div className="absolute right-4 bottom-32 flex flex-col items-center space-y-6 z-30">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.9 }}
          onClick={toggleLike}
          className="flex flex-col items-center group pointer-events-auto"
        >
          <div className={`flex items-center justify-center w-14 h-14 rounded-full backdrop-blur-xl border transition-all duration-300 shadow-2xl ${liked
            ? "bg-rose-500/20 border-rose-500/50 text-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.3)]"
            : "bg-black/40 border-white/10 text-white/80 hover:bg-white/10 hover:text-white"
            }`}>
            <Heart size={24} fill={liked ? "currentColor" : "none"} strokeWidth={2} />
          </div>
          <span className="mt-2 text-[10px] font-bold text-white/50 group-hover:text-white transition-opacity uppercase tracking-wider">
            Like
          </span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowInsight(!showInsight)}
          className="flex flex-col items-center group pointer-events-auto"
        >
          <div className={`flex items-center justify-center w-14 h-14 rounded-full backdrop-blur-xl border transition-all duration-300 shadow-2xl ${showInsight
            ? "bg-white text-black border-transparent"
            : "bg-black/40 border-white/10 text-white/80 hover:bg-white/10 hover:text-white"
            }`}>
            <Info size={24} strokeWidth={2} />
          </div>
          <span className="mt-2 text-[10px] font-bold text-white/50 group-hover:text-white transition-opacity uppercase tracking-wider">
            Why
          </span>
        </motion.button>
      </div>

      {/* Premium Metadata Layer */}
      <div className="absolute bottom-12 left-6 right-24 flex flex-col items-start space-y-4 z-20 pointer-events-none">

        <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 backdrop-blur-xl rounded-full border border-white/10">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          <span className="text-[11px] font-semibold text-white/90 tracking-wide">
            {video.channelTitle}
          </span>
        </div>

        <h3 className="text-xl md:text-2xl font-bold leading-tight tracking-tight text-white drop-shadow-md">
          {video.title}
        </h3>

        {/* Sleek Progress Indicator */}
        <div className="w-full max-w-[200px] h-1 bg-white/10 rounded-full mt-4 overflow-hidden relative backdrop-blur-md">
          {isActive && (
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: "0%" }}
              transition={{ duration: 15, ease: "linear" }}
              className="h-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]"
            />
          )}
        </div>
      </div>

      {/* Redesigned AI Insight Dashboard Overlay */}
      <AnimatePresence>
        {showInsight && isActive && (
          <motion.div
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(40px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            className="absolute inset-0 z-[100] bg-black/60 flex flex-col justify-end p-4 md:p-6 pb-8"
          >
            <motion.div
              initial={{ y: 50, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-full max-w-lg mx-auto bg-[#111113]/90 border border-white/10 rounded-[2rem] p-6 md:p-8 shadow-2xl relative overflow-hidden"
            >
              {/* Decorative top gradient */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500 opacity-50" />

              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-2 text-indigo-400">
                  <Sparkles size={18} />
                  <span className="text-xs font-bold uppercase tracking-widest">AI Alignment</span>
                </div>
                <button
                  onClick={() => setShowInsight(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-colors pointer-events-auto"
                >
                  <ChevronDown size={18} className="text-white/70" />
                </button>
              </div>

              <div className="space-y-8">
                {/* Intent Section */}
                <div className="space-y-2">
                  <p className="text-xs text-white/50 uppercase tracking-wider font-semibold">Matched Intent</p>
                  <p className="text-lg md:text-xl font-medium leading-snug text-white/90">
                    &quot;{video.originalQuery || video.reason}&quot;
                  </p>
                </div>

                {/* Metrics */}
                {intentProfile && (
                  <div className="space-y-6 pt-6 border-t border-white/5">

                    <div className="space-y-3">
                      <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-white/60">
                        <span className="flex items-center gap-1.5"><Target size={14} className="text-indigo-400" /> Learning</span>
                        <span className="flex items-center gap-1.5">Engagement <Activity size={14} className="text-rose-400" /></span>
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden flex">
                        <motion.div
                          initial={{ width: 0 }} animate={{ width: `${intentProfile.goal_mix.learning * 100}%` }}
                          transition={{ duration: 1, delay: 0.2 }}
                          className="h-full bg-indigo-500"
                        />
                        <motion.div
                          initial={{ width: 0 }} animate={{ width: `${intentProfile.goal_mix.entertainment * 100}%` }}
                          transition={{ duration: 1, delay: 0.2 }}
                          className="h-full bg-rose-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex flex-col gap-1">
                        <span className="text-[10px] uppercase tracking-widest text-white/40">Energy</span>
                        <span className="text-sm font-semibold capitalize text-white/90">{intentProfile.energy}</span>
                      </div>
                      <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex flex-col gap-1">
                        <span className="text-[10px] uppercase tracking-widest text-white/40">Tone</span>
                        <span className="text-sm font-semibold capitalize text-white/90">{intentProfile.tone}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scroll Hint */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 opacity-30 flex flex-col items-center gap-1 pointer-events-none">
        <span className="text-[9px] uppercase tracking-widest font-bold">Scroll</span>
        <ChevronDown size={16} className="animate-bounce" />
      </div>
    </div>
  );
}