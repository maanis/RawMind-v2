"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef, Suspense, useCallback } from "react";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
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
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [remainingCount, setRemainingCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [insightOpen, setInsightOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const loadingMoreRef = useRef(false);
  const recordedWatchSignalsRef = useRef<Set<string>>(new Set());

  // Persistence
  useEffect(() => {
    setDeviceId(getDeviceId());
    const savedProfile = localStorage.getItem("mindscroll_profile");
    if (savedProfile) {
      try {
        setUserProfile(JSON.parse(savedProfile) as UserProfile);
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (userProfile) localStorage.setItem("mindscroll_profile", JSON.stringify(userProfile));
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

  // LOADING STATE
  if (loading && !firstFetchComplete) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center space-y-4 bg-black overflow-hidden">
        <Loader2 className="animate-spin text-[var(--accent)]/70" size={40} strokeWidth={1.5} />
        <p className="text-white/25 text-[10px] font-medium uppercase tracking-[0.4em] animate-pulse">Curating your feed</p>
      </div>
    );
  }

  // EMPTY / ERROR STATE (only show after first fetch is actually complete)
  if (firstFetchComplete && (error || videos.length === 0)) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center p-6 text-center space-y-8 bg-[#0a0a0b] overflow-hidden">
        <div className="space-y-3">
            <h1 className="text-white font-display text-3xl tracking-tight">No exact match found.</h1>
            <p className="text-zinc-500 text-sm max-w-xs mx-auto">Try describing a specific mood or curiosity to help the AI align better.</p>
        </div>
        <button onClick={() => router.push("/")} className="px-10 py-3.5 accent-bg text-black text-sm font-semibold rounded-full shadow-2xl active:scale-95 transition-all">
          Adjust Request
        </button>
      </div>
    );
  }

  return (
    <main className="relative h-screen w-full bg-black flex justify-center selection:bg-white selection:text-black">
      {/* Immersive Back Button */}
      <div className="fixed top-0 left-0 z-[60] p-4 md:p-8 pointer-events-none">
        <button onClick={() => router.push("/")} className="pointer-events-auto p-3.5 glass rounded-full text-white/60 hover:text-white transition-all shadow-2xl active:scale-90">
          <ArrowLeft size={20} />
        </button>
      </div>

      <div
        ref={containerRef}
        className="h-full w-full overflow-y-auto no-scrollbar snap-y snap-mandatory flex flex-col items-center"
        style={{ scrollBehavior: 'smooth' }}
      >
        {videos.map((video, idx) => {
          const isVisible = Math.abs(idx - activeIndex) <= 1;
          
          return (
            <div 
                key={`${video.id}-${idx}`} 
                data-video-card 
                data-index={idx}
                className="w-full h-full min-h-screen flex items-center justify-center snap-center relative"
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
                    <Sparkles className="text-zinc-900 animate-pulse" size={48} strokeWidth={1.5} />
                </div>
              )}
            </div>
          );
        })}
        <div className="py-20 flex flex-col items-center opacity-30 group">
          <Sparkles className="mb-4 text-[var(--accent)]/60 transition-colors" size={26} strokeWidth={1.5} />
          <div className="text-zinc-600 text-[10px] font-medium uppercase tracking-[0.6em]">
            {hasMore ? "Loading more" : "You've reached the end"}
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
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <FeedContent />
    </Suspense>
  );
}
