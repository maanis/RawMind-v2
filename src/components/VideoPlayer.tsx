"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Info, Heart, ChevronDown, Search, Zap, Gauge } from "lucide-react";
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
    <div className="relative w-full h-full md:max-w-md lg:max-w-lg xl:max-w-2xl md:h-[90vh] md:rounded-[3rem] bg-black overflow-hidden md:shadow-[0_40px_100px_rgba(0,0,0,0.8)] snap-center flex-shrink-0 transition-transform duration-700 selection:bg-white selection:text-black">
      
      {/* Video Content */}
      <div className="absolute inset-0 z-0 bg-black flex items-center justify-center">
        {isActive ? (
          <iframe
            key={`mount-v-${video.id}`}
            className="w-full h-full object-cover pointer-events-none md:pointer-events-auto"
            src={`https://www.youtube.com/embed/${video.id}?autoplay=1&controls=0&modestbranding=1&rel=0&loop=1&playlist=${video.id}&showinfo=0&iv_load_policy=3&disablekb=1&enablejsapi=1&origin=${typeof window !== 'undefined' ? window.location.origin : ''}`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        ) : (
          <div className="flex flex-col items-center space-y-4">
            <div className="w-10 h-10 border-2 border-white/5 border-t-white/30 rounded-full animate-spin" />
            <p className="text-zinc-800 text-[9px] font-black uppercase tracking-widest animate-pulse">Curating Feed</p>
          </div>
        )}
      </div>

      {/* Modern Overlays (Instagram Style) */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black via-black/60 to-transparent pointer-events-none z-10" />
      
      {/* Action Rails (Right Side) */}
      <div className="absolute right-4 bottom-24 md:bottom-32 flex flex-col items-center space-y-8 z-30">
        <motion.button
          whileTap={{ scale: 0.8 }}
          onClick={toggleLike}
          className={`flex flex-col items-center space-y-1 group pointer-events-auto`}
        >
          <div className={`p-4 rounded-full glass border border-white/5 transition-all shadow-2xl ${liked ? "bg-[var(--accent)] text-black" : "text-white/80"}`}>
            <Heart size={26} fill={liked ? "currentColor" : "none"} strokeWidth={2.5} />
          </div>
          <span className="text-[10px] font-black text-white/40 group-hover:text-white transition-opacity uppercase tracking-tighter">Like</span>
        </motion.button>
        
        <motion.button
          whileTap={{ scale: 0.8 }}
          onClick={() => setShowInsight(!showInsight)}
          className={`flex flex-col items-center space-y-1 group pointer-events-auto`}
        >
          <div className={`p-4 rounded-full glass border border-white/5 text-white/80 transition-all shadow-2xl ${showInsight ? 'bg-[var(--accent)] text-black' : ''}`}>
            <Info size={26} strokeWidth={2.5} />
          </div>
          <span className="text-[10px] font-black text-white/40 group-hover:text-white transition-opacity uppercase tracking-tighter">Insight</span>
        </motion.button>
      </div>

      {/* Metadata (Left Bottom) */}
      <div className="absolute bottom-10 left-6 right-24 flex flex-col items-start space-y-4 z-20 pointer-events-none text-white">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full border border-white/10 backdrop-blur-3xl">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-100 italic">@{video.channelTitle}</span>
          </div>
        </div>
        
        <h3 className="text-xl md:text-2xl font-black leading-tight tracking-tighter drop-shadow-2xl max-w-lg">
          {video.title}
        </h3>
        
        <div className="w-full max-w-[200px] h-1 bg-white/10 rounded-full mt-2 overflow-hidden relative opacity-40">
            {isActive && (
                <motion.div 
                    initial={{ x: "-100%" }}
                    animate={{ x: "0%" }}
                    transition={{ duration: 15, ease: "linear" }}
                    className="h-full bg-white/60"
                />
            )}
        </div>
      </div>

      {/* Consolidated Insight Modal */}
      <AnimatePresence>
        {showInsight && isActive && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-3xl p-8 flex flex-col justify-center items-center text-center space-y-12"
          >
            <div className="space-y-6 max-w-sm">
                <div className="flex justify-center">
                    <div className="p-5 rounded-[2rem] bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/20">
                        <Search size={48} strokeWidth={1} />
                    </div>
                </div>
                <div className="space-y-2">
                    <h4 className="text-xs font-black tracking-[0.4em] text-white/40 uppercase">Starting Prompt</h4>
                    <p className="text-xl md:text-2xl font-bold leading-tight tracking-tight text-white italic px-4 select-none">
                        &quot;{video.originalQuery || video.reason}&quot;
                    </p>
                </div>
            </div>

            {intentProfile && (
                <div className="w-full max-w-sm space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                    {/* Metrics Logic */}
                    <div className="space-y-4">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-white/40">
                            <span>Insight {intentProfile.goal_mix.learning * 100}%</span>
                            <span>Engagement {intentProfile.goal_mix.entertainment * 100}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex">
                            <div className="h-full bg-[var(--accent)]" style={{ width: `${intentProfile.goal_mix.learning * 100}%` }} />
                            <div className="h-full bg-white/30" style={{ width: `${intentProfile.goal_mix.entertainment * 100}%` }} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="glass p-4 rounded-3xl border border-white/5 flex flex-col items-center space-y-2 group hover:bg-white/10 transition-all">
                            <Zap className="text-[var(--accent)] opacity-70 group-hover:opacity-100 transition-opacity" size={20} />
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">{intentProfile.energy} Energy</span>
                        </div>
                        <div className="glass p-4 rounded-3xl border border-white/5 flex flex-col items-center space-y-2 group hover:bg-white/10 transition-all">
                            <Gauge className="text-[var(--accent)] opacity-70 group-hover:opacity-100 transition-opacity" size={20} />
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">{intentProfile.tone} Tone</span>
                        </div>
                    </div>
                </div>
            )}

            <button 
                onClick={(e) => { e.stopPropagation(); setShowInsight(false); }}
                className="px-10 py-4 accent-bg text-black text-xs font-semibold uppercase tracking-wide rounded-full hover:brightness-110 pointer-events-auto shadow-2xl active:scale-95 transition-all"
            >
                Back to Feed
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Scroll Hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 opacity-20 hidden group-hover:block transition-all">
          <ChevronDown size={24} className="animate-bounce" />
      </div>
    </div>
  );
}
