"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, LockKeyhole, Sparkles } from "lucide-react";

type ProgressLockProps = {
  children?: ReactNode;
};

export default function ProgressLock({ children }: ProgressLockProps) {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#09090b] px-6 py-10 text-zinc-100 [color-scheme:dark]">
      <div aria-hidden className="absolute inset-0">
        <div
          className="absolute inset-0 scale-105 bg-cover bg-center opacity-25 blur-sm"
          style={{ backgroundImage: "url('/hero.png')" }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 20%, rgba(99,102,241,0.2), transparent 35%), linear-gradient(180deg, rgba(9,9,11,0.55), rgba(9,9,11,0.96))",
          }}
        />
      </div>

      {children ? (
        <div
          aria-hidden
          inert
          className="pointer-events-none absolute inset-0 select-none overflow-hidden opacity-20 blur-[3px]"
        >
          {children}
        </div>
      ) : null}

      <div className="relative z-10 flex min-h-[calc(100dvh-5rem)] items-center justify-center">
        <section className="w-full max-w-md rounded-2xl border border-white/10 bg-black/55 p-6 text-center shadow-[0_30px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:p-8">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white">
            <LockKeyhole size={24} />
          </div>

          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/60">
            <Sparkles size={13} className="text-indigo-300" />
            <span>Under Progress</span>
          </div>

          <h1 className="font-serif text-3xl leading-tight tracking-tight text-white sm:text-4xl">
            This page is locked.
          </h1>
          <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-zinc-300">
            RawMind is still being shaped. Till then, enjoy MindScroll on the home route.
          </p>

          <Link
            href="/"
            className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-zinc-200"
          >
            Enjoy MindScroll
            <ArrowRight size={16} />
          </Link>

          {/* <p className="mt-4 text-[11px] font-medium text-white/40">Available now at /</p> */}
        </section>
      </div>
    </div>
  );
}