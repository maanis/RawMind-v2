"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef, Suspense, useCallback } from "react";
import { ArrowLeft, Loader2, Sparkles, Activity } from "lucide-react";
import { motion } from "framer-motion";
import VideoPlayer from "@/components/VideoPlayer";
import InsightBar from "@/components/InsightBar";
import { FeedSignal, FeedVideo, IntentProfile, UserProfile } from "@/lib/feed/types";
import { getDeviceId } from "@/lib/device";
import { parseErrorPayload, parseFeedPagePayload, parseSignalPayload } from "@/lib/feed/contracts";

type Video = FeedVideo;
type Signal = Omit<FeedSignal, "sessionId" | "deviceId">;
type SignalValue = Signal["value"];

function FeedContent() {
  const searchParams = useSearchParams();
  const prompt = searchParams.get("prompt") ?? searchParams.get("intent");
  const router = useRouter();

  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [firstFetchComplete, setFirstFetchComplete] = useState(false);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [intentProfile, setIntentProfile] = useState<IntentProfile | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    if (typeof window === "undefined") return null;
    const savedProfile = window.localStorage.getItem("rawmind_profile");
    if (!savedProfile) return null;
    try {
      return JSON.parse(savedProfile) as UserProfile;
    } catch {
      return null;
    }
  });
  const [sessionId, setSessionId] = useState("");
  const [deviceId] = useState(() => {
    if (typeof window === "undefined") return "";
    return getDeviceId();
  });
  const [remainingCount, setRemainingCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [insightOpen, setInsightOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const loadingMoreRef = useRef(false);
  const recordedWatchSignalsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (userProfile) localStorage.setItem("rawmind_profile", JSON.stringify(userProfile));
  }, [userProfile]);

  const startSession = useCallback(async () => {
    if (!prompt || !deviceId) return;
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setFirstFetchComplete(false);
      setError("");
      setVideos([]);
      setActiveIndex(0);
      recordedWatchSignalsRef.current.clear();

      const res = await fetch("/api/feed/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, deviceId }),
        signal: abortControllerRef.current.signal
      });
      if (!res.ok) {
        const err = await parseErrorPayload(res);
        throw new Error(err.error || "Failed to fetch");
      }
      const data = await parseFeedPagePayload(res);

      setSessionId(data.sessionId ?? "");
      setVideos(data.videos ?? []);
      setRemainingCount(data.remainingCount ?? 0);
      setHasMore(Boolean(data.hasMore ?? true));
      if (data.intentProfile) setIntentProfile(data.intentProfile);
      if (data.profile) setUserProfile(data.profile as UserProfile);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to start feed session");
    } finally {
      setLoading(false);
      setFirstFetchComplete(true);
    }
  }, [deviceId, prompt]);

  const fetchNextPage = useCallback(async () => {
    if (!sessionId || !deviceId || loadingMoreRef.current || !hasMore) return;
    loadingMoreRef.current = true;

    try {
      const res = await fetch("/api/feed/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, deviceId }),
      });
      if (!res.ok) {
        const err = await parseErrorPayload(res);
        throw new Error(err.error || "Failed to load more videos");
      }
      const data = await parseFeedPagePayload(res);

      const newVideos: Video[] = data.videos ?? [];
      setVideos((prev) => {
        const existingIds = new Set(prev.map((video) => video.id));
        const filtered = newVideos.filter((video) => !existingIds.has(video.id));
        return [...prev, ...filtered];
      });
      setRemainingCount(data.remainingCount ?? 0);
      setHasMore(Boolean(data.hasMore));
      if (data.intentProfile) setIntentProfile(data.intentProfile);
      if (data.profile) setUserProfile(data.profile as UserProfile);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load more videos");
    } finally {
      loadingMoreRef.current = false;
    }
  }, [deviceId, hasMore, sessionId]);

  const sendSignal = useCallback(async (signal: Signal) => {
    if (!sessionId || !deviceId) return;

    try {
      const response = await fetch("/api/feed/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          deviceId,
          ...signal,
        }),
      });
      if (!response.ok) return;
      const data = await parseSignalPayload(response);
      if (data.profile) {
        setUserProfile(data.profile);
      }
    } catch (err) {
      console.error("Failed to send signal:", err);
    }
  }, [deviceId, sessionId]);

  // Observer
  useEffect(() => {
    if (!containerRef.current || videos.length === 0) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveIndex(parseInt(entry.target.getAttribute('data-index') || '0'));
        }
      });
    }, { root: containerRef.current, threshold: 0.6 });

    containerRef.current.querySelectorAll('[data-video-card]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [videos.length]);

  // Initial fetch
  useEffect(() => {
    if (!prompt) {
      router.push("/");
      return;
    }
    if (!deviceId) return;
    void startSession();
  }, [prompt, router, startSession, deviceId]);

  // Load More
  useEffect(() => {
    if (videos.length === 0 || loading || loadingMoreRef.current || !hasMore) return;
    if (activeIndex >= videos.length - 3 || remainingCount <= 3) {
      void fetchNextPage();
    }
  }, [activeIndex, videos.length, loading, hasMore, remainingCount, fetchNextPage]);

  const handleSignal = useCallback((videoId: string, type: 'watchTime' | 'like', value: SignalValue) => {
    if (type === "watchTime") {
      const fingerprint = `${videoId}:${Math.round(Number(value) || 0)}`;
      if (recordedWatchSignalsRef.current.has(fingerprint)) return;
      recordedWatchSignalsRef.current.add(fingerprint);
    }

    const signal = { videoId, type, value, timestamp: Date.now() } as Signal;
    void sendSignal(signal);
  }, [sendSignal]);

  // Premium Loading State
  if (loading && !firstFetchComplete) {
    return (
      <div className="relative flex h-[100dvh] w-full flex-col items-center justify-center overflow-hidden bg-[#09090b] [color-scheme:dark]">
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="absolute w-64 h-64 bg-indigo-500/20 rounded-full blur-[80px]"
        />
        <div className="relative z-10 flex flex-col items-center space-y-6">
          <div className="p-4 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl">
            <Activity className="text-white animate-pulse" size={32} />
          </div>
          <p className="text-white/60 text-xs font-medium uppercase tracking-[0.4em] animate-pulse">Curating your feed</p>
        </div>
      </div>
    );
  }

  // Premium Empty/Error State
  if (firstFetchComplete && (error || videos.length === 0)) {
    return (
      <div className="flex h-[100dvh] w-full flex-col items-center justify-center space-y-8 overflow-hidden bg-[#09090b] p-6 text-center [color-scheme:dark]">
        <div className="p-8 rounded-[2rem] bg-white/5 border border-white/10 backdrop-blur-xl max-w-md w-full flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-6">
            <Sparkles className="text-white/50" size={28} />
          </div>
          <h1 className="text-white text-2xl font-semibold tracking-tight mb-3">No exact match found.</h1>
          <p className="text-zinc-400 text-sm mb-8 leading-relaxed">Try describing a specific mood or curiosity to help the AI align better with your intent.</p>
          <button
            onClick={() => router.push("/")}
            className="w-full py-4 bg-white text-black text-sm font-semibold rounded-xl hover:bg-zinc-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.1)]"
          >
            Adjust Request
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="relative flex h-[100dvh] w-full justify-center overflow-hidden bg-black [color-scheme:dark] selection:bg-indigo-500/30 selection:text-white">

      {/* Immersive Back Button */}
      <div className="fixed top-6 left-6 z-[60]">
        <button
          onClick={() => router.push("/")}
          className="flex items-center justify-center w-12 h-12 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-all shadow-2xl active:scale-95"
        >
          <ArrowLeft size={20} />
        </button>
      </div>

      {/* Edge-to-Edge Feed Container */}
      <div
        ref={containerRef}
        className="h-[100dvh] w-full overflow-y-auto no-scrollbar snap-y snap-mandatory flex flex-col"
        style={{ scrollBehavior: 'smooth' }}
      >
        {videos.map((video, idx) => {
          const isVisible = Math.abs(idx - activeIndex) <= 1;

          return (
            <div
              key={`${video.id}-${idx}`}
              data-video-card
              data-index={idx}
              className="w-full h-[100dvh] flex-shrink-0 snap-center relative bg-black"
            >
              {isVisible ? (
                <VideoPlayer
                  video={video}
                  isActive={idx === activeIndex}
                  onSignal={handleSignal}
                  intentProfile={intentProfile}
                />
              ) : (
                <div className="w-full h-full bg-black flex items-center justify-center">
                  <Loader2 className="text-white/20 animate-spin" size={32} />
                </div>
              )}
            </div>
          );
        })}

        {/* End of Feed Indicator */}
        <div className="h-[30vh] flex-shrink-0 snap-center flex flex-col items-center justify-center opacity-40">
          <Sparkles className="mb-4 text-white/50" size={24} />
          <div className="text-white/40 text-[10px] font-medium uppercase tracking-[0.4em]">
            {hasMore ? "Curating more..." : "End of exploration"}
          </div>
        </div>
      </div>

      <InsightBar
        topicAffinities={userProfile?.topicAffinities ?? {}}
        channelAffinities={userProfile?.channelAffinities ?? {}}
        totalLikes={userProfile?.totalLikes ?? 0}
        totalSignals={userProfile?.totalSignals ?? 0}
        isOpen={insightOpen}
        onToggle={() => setInsightOpen((prev) => !prev)}
      />
    </main>
  );
}

export default function FeedPage() {
  return (
    <Suspense fallback={<div className="h-[100dvh] w-full bg-[#09090b] [color-scheme:dark]" />}>
      <FeedContent />
    </Suspense>
  );
}