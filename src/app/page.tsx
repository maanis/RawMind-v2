"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, ArrowUp, Loader2, Square, Rocket, Zap, Brain, Sparkles, Code2 } from "lucide-react";

type RecordingState = "idle" | "recording" | "transcribing";
type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
};

type SpeechRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: {
      transcript: string;
    };
  }>;
};

type SpeechRecognitionErrorEvent = {
  error: string;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

// --- Nature Animation Components to match hero.png ---
// hero.png reference: blue sky + soft clouds top-left, rolling green grass
// bottom-right scattered with small white/pink-tipped daisies and a few
// pale-blue flowers, shot with shallow depth of field.

// A single daisy: 6 petals radiating from a warm yellow/orange center.
// Petal color + tip-tint is randomized per-flower to match the mix seen
// in the hero photo (mostly white with pink tips, a handful pale blue).
const Flower = ({
  size,
  petalColor,
  tipColor,
  centerColor,
}: {
  size: number;
  petalColor: string;
  tipColor: string;
  centerColor: string;
}) => (
  <svg viewBox="0 0 32 32" width={size} height={size} style={{ overflow: "visible" }}>
    <g>
      {[0, 60, 120, 180, 240, 300].map((angle) => (
        <g key={angle} transform={`rotate(${angle} 16 16)`}>
          <path
            d="M16 16 C 13.2 12, 13.2 5, 16 2 C 18.8 5, 18.8 12, 16 16 Z"
            fill={petalColor}
          />
          <path
            d="M16 2 C 17.2 3.6, 17.4 5.4, 16 7 C 14.6 5.4, 14.8 3.6, 16 2 Z"
            fill={tipColor}
            opacity="0.85"
          />
        </g>
      ))}
      <circle cx="16" cy="16" r="4.2" fill={centerColor} />
      <circle cx="16" cy="16" r="4.2" fill="url(#centerShade)" opacity="0.5" />
      <radialGradient id="centerShade" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stopColor="#fff8d6" />
        <stop offset="100%" stopColor="#c98a1f" />
      </radialGradient>
    </g>
  </svg>
);

// A small flying bird: two wing paths that morph between "raised" and
// "lowered" to read as a real flap cycle, plus a simple body/head.
const Bird = ({ size, tone }: { size: number; tone: string }) => {
  const wingUp =
    "M16 11 C 11 3, 4 2, 0 6 C 5 6.5, 10 8.5, 16 11 C 22 8.5, 27 6.5, 32 6 C 28 2, 21 3, 16 11 Z";
  const wingDown =
    "M16 11 C 11 15, 4 17, 0 13 C 5 12, 10 12, 16 11 C 22 12, 27 12, 32 13 C 28 17, 21 15, 16 11 Z";

  return (
    <svg viewBox="0 0 32 20" width={size} height={size * 0.625} style={{ overflow: "visible" }}>
      <motion.path
        d={wingUp}
        fill={tone}
        animate={{ d: [wingUp, wingDown, wingUp] }}
        transition={{ duration: 0.55, repeat: Infinity, ease: "easeInOut" }}
      />
      <ellipse cx="16" cy="11" rx="2.6" ry="1.6" fill={tone} />
      <path d="M18 10.3 L22 9.6 L18.6 11.2 Z" fill={tone} />
    </svg>
  );
};

const flowerPalette = [
  { petalColor: "#ffffff", tipColor: "#f3a6c4", centerColor: "#f5c93b" },
  { petalColor: "#ffffff", tipColor: "#e8637f", centerColor: "#f0b429" },
  { petalColor: "#eaf4fb", tipColor: "#a9d3ef", centerColor: "#f5c93b" },
  { petalColor: "#fdf1f6", tipColor: "#f7b8cf", centerColor: "#f0b429" },
];

const flowers = Array.from({ length: 6 }, (_, i) => {
  const palette = flowerPalette[i % flowerPalette.length];
  return {
    id: i,
    x: [8, 20, 34, 58, 72, 88][i],
    delay: [0.4, 1.2, 2.3, 3.1, 4.6, 5.2][i],
    duration: [16, 18, 20, 22, 24, 26][i],
    size: [9, 11, 13, 10, 14, 12][i],
    rotateDir: i % 2 === 0 ? 1 : -1,
    ...palette,
  };
});

const birds = Array.from({ length: 2 }, (_, i) => ({
  id: i,
  top: i === 0 ? 12 : 24,
  delay: i === 0 ? 1.2 : 3.4,
  duration: i === 0 ? 34 : 40,
  size: i === 0 ? 24 : 30,
  tone: i % 2 === 0 ? "rgba(20,30,45,0.55)" : "rgba(255,255,255,0.6)",
}));

const NatureEffects = () => {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
      {/* Subtle moving clouds */}
      <motion.div
        animate={{ x: ["-10%", "110%"] }}
        transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
        className="absolute top-[10%] -left-[20%] w-[30vw] h-[10vh] bg-white/20 blur-[60px] rounded-full"
      />
      <motion.div
        animate={{ x: ["-10%", "110%"] }}
        transition={{ duration: 160, repeat: Infinity, ease: "linear", delay: 20 }}
        className="absolute top-[25%] -left-[30%] w-[40vw] h-[15vh] bg-white/10 blur-[80px] rounded-full"
      />

      {/* Floating daisy petals drifting up from the flower bed */}
      {flowers.map((flower) => (
        <motion.div
          key={`flower-${flower.id}`}
          initial={{ y: "110vh", x: `${flower.x}vw`, opacity: 0, rotate: 0 }}
          animate={{
            y: "-10vh",
            x: [`${flower.x}vw`, `${flower.x + 2}vw`],
            opacity: [0, 0.9, 0.9, 0],
            rotate: 360 * flower.rotateDir,
          }}
          transition={{
            duration: flower.duration,
            repeat: Infinity,
            delay: flower.delay,
            ease: "linear",
          }}
          className="absolute"
        >
          <Flower
            size={flower.size}
            petalColor={flower.petalColor}
            tipColor={flower.tipColor}
            centerColor={flower.centerColor}
          />
        </motion.div>
      ))}

      {/* Birds flying across the sky with real wing-flap motion */}
      {birds.map((bird) => (
        <motion.div
          key={`bird-${bird.id}`}
          initial={{ x: "-10vw", y: `${bird.top}vh` }}
          animate={{
            x: "110vw",
            y: [`${bird.top}vh`, `${bird.top - 2}vh`, `${bird.top + 2}vh`, `${bird.top}vh`],
          }}
          transition={{
            x: { duration: bird.duration, repeat: Infinity, delay: bird.delay, ease: "linear" },
            y: { duration: 4, repeat: Infinity, ease: "easeInOut" },
          }}
          className="absolute"
        >
          <Bird size={bird.size} tone={bird.tone} />
        </motion.div>
      ))}
    </div>
  );
};

export default function Home() {
  const [intent, setIntent] = useState("");
  const [voiceState, setVoiceState] = useState<RecordingState>("idle");
  const [voiceError, setVoiceError] = useState("");
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioBuffersRef = useRef<Float32Array[]>([]);
  const sampleRateRef = useRef(44100);
  const speechRecognitionSupportedRef = useRef(false);

  // Auto-resize textarea logic
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [intent]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      speechRecognitionSupportedRef.current = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
    }

    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      processorRef.current?.disconnect();
      sourceRef.current?.disconnect();
      void audioContextRef.current?.close();
    };
  }, []);

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!intent.trim()) return;
    router.push(`/feed?prompt=${encodeURIComponent(intent.trim())}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const encodeWav = (buffers: Float32Array[], sampleRate: number) => {
    const totalLength = buffers.reduce((sum, buffer) => sum + buffer.length, 0);
    const pcmData = new Int16Array(totalLength);
    let offset = 0;

    for (const buffer of buffers) {
      for (let index = 0; index < buffer.length; index += 1) {
        const sample = Math.max(-1, Math.min(1, buffer[index]));
        pcmData[offset] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        offset += 1;
      }
    }

    const wavBuffer = new ArrayBuffer(44 + pcmData.length * 2);
    const view = new DataView(wavBuffer);

    const writeString = (position: number, value: string) => {
      for (let index = 0; index < value.length; index += 1) {
        view.setUint8(position + index, value.charCodeAt(index));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + pcmData.length * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, pcmData.length * 2, true);

    for (let index = 0; index < pcmData.length; index += 1) {
      view.setInt16(44 + index * 2, pcmData[index], true);
    }

    return new Blob([wavBuffer], { type: "audio/wav" });
  };

  const transcribeWithNvidia = async (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append("audio", new File([audioBlob], "rawmind-recording.wav", { type: "audio/wav" }));
    formData.append("language", "en");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    const response = await fetch("/api/transcribe", {
      method: "POST",
      body: formData,
      signal: controller.signal,
    }).finally(() => {
      clearTimeout(timeout);
    });

    const data = (await response.json()) as { error?: string; text?: string };
    if (!response.ok) {
      throw new Error(data.error || "Transcription failed");
    }

    const transcript = data.text?.trim();
    if (!transcript) {
      throw new Error("No speech detected");
    }

    return transcript;
  };

  const transcribeWithWebSpeech = async () => {
    const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionConstructor) {
      throw new Error("Speech recognition is not supported in this browser");
    }

    return new Promise<string>((resolve, reject) => {
      const recognition = new SpeechRecognitionConstructor();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";
      let settled = false;
      let hasResult = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        recognition.stop();
        reject(new Error("Voice recognition timed out"));
      }, 12_000);

      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        fn();
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript?.trim() ?? "";
        if (!transcript) {
          finish(() => reject(new Error("No speech detected")));
          return;
        }
        hasResult = true;
        finish(() => resolve(transcript));
      };

      recognition.onerror = (event) => {
        finish(() =>
          reject(
            new Error(
              event.error === "not-allowed" ? "Microphone permission was denied" : `Voice input failed: ${event.error}`
            )
          )
        );
      };

      recognition.onend = () => {
        if (hasResult) return;
        finish(() => reject(new Error("Speech ended before a transcript was captured. Tap mic and speak right away.")));
      };

      recognition.start();
    });
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    if (process.env.NEXT_PUBLIC_HAS_NVIDIA === "true") {
      try {
        return await transcribeWithNvidia(audioBlob);
      } catch {
        // Falls back to browser speech recognition if NVIDIA path fails.
      }
    }
    return transcribeWithWebSpeech();
  };

  const transcribeRecording = async (audioBlob: Blob) => {
    setVoiceState("transcribing");
    setVoiceError("");

    try {
      const transcript = await transcribeAudio(audioBlob);

      setIntent((previous) => {
        const nextValue = previous.trim() ? `${previous.trim()} ${transcript}` : transcript;
        return nextValue;
      });

      requestAnimationFrame(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
      });
    } catch (error) {
      console.error("Voice transcription failed:", error);
      setVoiceError(error instanceof Error ? error.message : "Unable to transcribe audio");
    } finally {
      setVoiceState("idle");
    }
  };

  const stopRecording = async () => {
    if (voiceState !== "recording") return;

    processorRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    stopStream();
    await audioContextRef.current?.close();
    audioContextRef.current = null;

    const audioBlob = encodeWav(audioBuffersRef.current, sampleRateRef.current);
    audioBuffersRef.current = [];

    if (audioBlob.size === 0) {
      setVoiceState("idle");
      setVoiceError("No audio was captured");
      return;
    }

    await transcribeRecording(audioBlob);
  };

  const handleVoiceInput = async () => {
    if (voiceState === "transcribing") return;

    if (voiceState === "recording") {
      await stopRecording();
      return;
    }

    setVoiceError("");

    try {
      if (typeof window === "undefined" || typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone access is not supported in this browser");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new window.AudioContext({ sampleRate: 16000 });
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      streamRef.current = stream;
      audioContextRef.current = audioContext;
      sourceRef.current = source;
      processorRef.current = processor;
      audioBuffersRef.current = [];
      sampleRateRef.current = audioContext.sampleRate;

      processor.onaudioprocess = (event) => {
        const channelData = event.inputBuffer.getChannelData(0);
        audioBuffersRef.current.push(new Float32Array(channelData));
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
      await audioContext.resume();
      setVoiceState("recording");
    } catch (error) {
      console.error("Voice capture failed:", error);
      stopStream();
      processorRef.current?.disconnect();
      processorRef.current = null;
      sourceRef.current?.disconnect();
      sourceRef.current = null;
      await audioContextRef.current?.close();
      audioContextRef.current = null;
      audioBuffersRef.current = [];
      setVoiceState("idle");
      setVoiceError(error instanceof Error ? error.message : "Unable to access microphone");
    }
  };

  // Inside your component:
  const suggestions = [
    { text: "Practice DSA in a fun way", icon: Rocket, color: "text-orange-400" },
    { text: "Learn something interesting", icon: Sparkles, color: "text-blue-400" },
    { text: "Prepare for interviews today", icon: Zap, color: "text-emerald-400" },
  ];

  return (
    <main className="relative flex h-[100dvh] max-h-[100dvh] min-h-0 w-full flex-col items-center justify-center overflow-hidden bg-[#09090b] px-3 pb-24 pt-3 text-zinc-100 [color-scheme:dark] selection:bg-indigo-500/30 selection:text-white sm:px-4 sm:pt-4 md:p-8">

      {/* Background Image Layer */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {/* Image */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-80"
          style={{ backgroundImage: "url('/hero.png')" }}
        />

        {/* Heavy film grain */}
        <div
          className="absolute inset-0 opacity-[0.35] mix-blend-overlay"
          style={{
            backgroundImage: `
        url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.2' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")
      `,
            backgroundSize: "50px 50px",
          }}
        />
      </div>

      {/* Injecting the new Nature SVG Animations */}
      <NatureEffects />

      {/* UI Content Layer */}
      <div className="z-10 flex w-full max-w-2xl flex-col items-center gap-5 sm:gap-8 md:gap-12">

        {/* Serif Typography Header */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-2 text-center sm:space-y-4"
        >
          <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/30 px-2.5 py-1 text-[11px] font-medium text-white shadow-lg backdrop-blur-md sm:mb-2 sm:px-3 sm:text-xs">
            <Sparkles size={14} className="text-white" />
            <span>AI Powered Exploration</span>
          </div>
          <h1 className="font-serif text-[2.35rem] font-normal leading-[1.08] tracking-tight text-white drop-shadow-lg sm:text-5xl sm:leading-[1.15] md:text-6xl lg:text-7xl">
            Curated knowledge.<br />
            <span className="text-white/80 italic">Unfiltered thought.</span>
          </h1>
        </motion.div>

        {/* Glassmorphic Command Input */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="w-full relative px-2 md:px-0"
        >
          <div className="absolute -inset-0.5 bg-gradient-to-r from-white/20 to-white/10 rounded-[2rem] blur opacity-0 transition duration-500 group-focus-within:opacity-100" />

          <form
            onSubmit={handleSearch}
            className="group relative flex flex-col w-full bg-black/50 max-sm:my-10 backdrop-blur-3xl border border-white/20 rounded-[1rem] transition-all duration-300 focus-within:border-white/40  focus-within:bg-black/70 shadow-[0_30px_60px_rgba(0,0,0,0.4)] overflow-hidden"
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                voiceState === "recording"
                  ? "Listening carefully..."
                  : voiceState === "transcribing"
                    ? "Turning voice to text..."
                    : "Ask anything, learn something new..."
              }
              className="no-scrollbar min-h-[58px] max-h-28 w-full resize-none overflow-y-auto bg-transparent px-4 py-4 text-base text-white outline-none transition-all placeholder:text-white/60 sm:min-h-[70px] sm:max-h-40 sm:px-6 sm:py-5 sm:text-lg md:py-6"
            />

            <div className="flex items-center justify-between px-3 pb-3 pt-1 sm:px-4 sm:pb-4">
              <div className="flex-1 min-h-6 flex items-center px-2">
                <AnimatePresence mode="wait">
                  {voiceState === "recording" ? (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-3 text-xs font-medium uppercase tracking-widest text-rose-300"
                    >
                      <div className="flex items-center gap-1">
                        {[0, 1, 2, 3, 4].map((index) => (
                          <motion.span
                            key={index}
                            animate={{ scaleY: [0.3, 1, 0.3] }}
                            transition={{ duration: 0.8, repeat: Infinity, delay: index * 0.1 }}
                            className="h-4 w-[3px] rounded-full bg-rose-400"
                          />
                        ))}
                      </div>
                      <span>Listening</span>
                    </motion.div>
                  ) : voiceState === "transcribing" ? (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-blue-300"
                    >
                      <Loader2 className="animate-spin" size={14} />
                      <span>Transcribing</span>
                    </motion.div>
                  ) : voiceError ? (
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-3"
                    >
                      <p className="text-sm text-rose-300">{voiceError}</p>
                      <button
                        type="button"
                        onClick={() => void handleVoiceInput()}
                        className="text-xs uppercase tracking-wider text-white/60 hover:text-white transition-colors"
                      >
                        Retry
                      </button>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={() => void handleVoiceInput()}
                  disabled={voiceState === "transcribing"}
                  className={`flex p-3 rounded-xl transition-all duration-300 ${voiceState === "recording"
                    ? "text-rose-400 bg-rose-500/20 shadow-[0_0_20px_rgba(244,63,94,0.4)]"
                    : voiceState === "transcribing"
                      ? "text-white/40 bg-transparent"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                    }`}
                >
                  {voiceState === "recording" ? <Square size={20} fill="currentColor" /> : <Mic size={20} />}
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="submit"
                  disabled={!intent.trim() || voiceState === "recording" || voiceState === "transcribing"}
                  className="flex p-3 bg-white text-black rounded-xl hover:bg-zinc-200 disabled:opacity-30 disabled:hover:bg-white transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                >
                  <ArrowUp size={20} className="stroke-[2.5]" />
                </motion.button>
              </div>
            </div>
          </form>
        </motion.div>

        {/* Upgraded Modern Chips */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex w-full max-w-lg flex-wrap items-center justify-center gap-2 px-2 sm:gap-2.5 sm:px-4"
        >
          {suggestions.map((suggestion, idx) => {
            const Icon = suggestion.icon;
            return (
              <motion.button
                key={idx}
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setIntent(suggestion.text);
                  setTimeout(() => textareaRef.current?.focus(), 0);
                }}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/20 bg-black/40 px-3 py-2 shadow-lg backdrop-blur-md transition-all hover:border-white/40 hover:bg-black/60 sm:px-3.5"
              >
                <Icon size={14} className={suggestion.color} />
                <span className="text-[11px] font-medium text-white sm:text-xs md:text-sm">{suggestion.text}</span>
              </motion.button>
            );
          })}
        </motion.div>
      </div>
    </main>
  );
}