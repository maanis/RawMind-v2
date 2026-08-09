"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, ArrowUp, Loader2, Square, Sparkles, Rocket, Zap } from "lucide-react";

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
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
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
    formData.append("audio", new File([audioBlob], "mindscroll-recording.wav", { type: "audio/wav" }));
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

  // Upgraded suggestions with icons and styling logic
  const suggestions = [
    { text: "Learn startups in a fun way", icon: Rocket, color: "text-orange-400" },
    { text: "Show something interesting", icon: Sparkles, color: "text-blue-400" },
    { text: "Give me productive content", icon: Zap, color: "text-emerald-400" },
  ];

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 md:p-8 relative overflow-hidden bg-[#09090b] text-zinc-100 selection:bg-indigo-500/30 selection:text-white">

      {/* Animated Ambient Background Magic */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.4, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[80%] w-[600px] h-[600px] bg-indigo-600/20 blur-[120px] rounded-full"
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.3, 0.2] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-[-20%] w-[500px] h-[500px] bg-fuchsia-600/10 blur-[100px] rounded-full"
        />
      </div>

      <div className="z-10 w-full max-w-2xl flex flex-col items-center space-y-12 md:space-y-16 mt-[-10vh]">

        {/* Modern Typography Header */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-center space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-zinc-400 backdrop-blur-md mb-2">
            <Sparkles size={14} className="text-indigo-400" />
            <span>AI Powered Mindscroll</span>
          </div>
          <h1 className="font-sans text-5xl md:text-7xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-white via-zinc-200 to-zinc-600 pb-2">
            What's on your mind?
          </h1>
        </motion.div>

        {/* Glassmorphic Command Input */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="w-full relative"
        >
          <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/30 to-purple-500/30 rounded-[2rem] blur opacity-0 transition duration-500 group-focus-within:opacity-100" />

          <form
            onSubmit={handleSearch}
            className="group relative flex flex-col w-full bg-zinc-900/60 backdrop-blur-2xl border border-white/10 rounded-[2rem] transition-all duration-300 focus-within:border-indigo-500/50 focus-within:bg-zinc-900/80 shadow-2xl overflow-hidden"
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
              className="w-full bg-transparent text-zinc-100 placeholder:text-zinc-500 px-6 py-6 outline-none text-lg md:text-xl resize-none overflow-y-auto no-scrollbar min-h-[80px] transition-all"
            />

            <div className="flex items-center justify-between px-4 pb-4 pt-2">
              <div className="flex-1 min-h-6 flex items-center px-2">
                <AnimatePresence mode="wait">
                  {voiceState === "recording" ? (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-3 text-xs font-medium uppercase tracking-widest text-rose-400"
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
                      className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-indigo-400"
                    >
                      <Loader2 className="animate-spin" size={14} />
                      <span>Transcribing</span>
                    </motion.div>
                  ) : voiceError ? (
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-3"
                    >
                      <p className="text-sm text-rose-400">{voiceError}</p>
                      <button
                        type="button"
                        onClick={() => void handleVoiceInput()}
                        className="text-xs uppercase tracking-wider text-zinc-500 hover:text-white transition-colors"
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
                    ? "text-rose-400 bg-rose-500/10 shadow-[0_0_20px_rgba(244,63,94,0.2)]"
                    : voiceState === "transcribing"
                      ? "text-zinc-600 bg-transparent"
                      : "text-zinc-400 hover:text-white hover:bg-white/10"
                    }`}
                >
                  {voiceState === "recording" ? <Square size={20} fill="currentColor" /> : <Mic size={20} />}
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="submit"
                  disabled={!intent.trim() || voiceState === "recording" || voiceState === "transcribing"}
                  className="flex p-3 bg-white text-black rounded-xl hover:bg-zinc-200 disabled:opacity-20 disabled:hover:bg-white transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]"
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
          className="flex flex-wrap items-center justify-center gap-3 w-full max-w-lg"
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
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all cursor-pointer backdrop-blur-sm"
              >
                <Icon size={14} className={suggestion.color} />
                <span className="text-sm font-medium text-zinc-300">{suggestion.text}</span>
              </motion.button>
            );
          })}
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
        className="absolute bottom-8 flex flex-col items-center gap-2"
      >
        <div className="w-[1px] h-12 bg-gradient-to-b from-zinc-500/0 via-zinc-500/50 to-zinc-500/0" />
        <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-600 font-medium">
          Scroll to explore
        </p>
      </motion.div>
    </main>
  );
}