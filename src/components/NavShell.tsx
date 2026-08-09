"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Compass, MessageCircle, Moon, Settings, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { href: "/", label: "MindScroll", match: (p: string) => p === "/" || p.startsWith("/feed"), icon: Compass },
  { href: "/rawmind", label: "RawMind", match: (p: string) => p.startsWith("/rawmind") && !p.startsWith("/rawmind/settings"), icon: MessageCircle },
  { href: "/rawmind/settings", label: "Settings", match: (p: string) => p.startsWith("/rawmind/settings"), icon: Settings },
];

const IMMERSIVE_PREFIXES = ["/feed", "/rawmind/chat"];
type ThemeMode = "light" | "dark";
const THEME_STORAGE_KEY = "mindscroll-theme";

function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
}

export default function NavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const immersive = IMMERSIVE_PREFIXES.some((p) => pathname.startsWith(p));
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") {
      return "dark";
    }

    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    return storedTheme === "light" || storedTheme === "dark"
      ? storedTheme
      : prefersDark
        ? "dark"
        : "light";
  });

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    applyTheme(theme);
  }, [theme]);

  if (immersive) {
    return <>{children}</>;
  }

  const toggleTheme = () => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  };

  return (
    <div className="min-h-screen flex flex-col relative">

      {/* Main Content Area */}
      <main className="flex-1 w-full pb-32">
        {children}
      </main>

      {/* Floating Dynamic Dock (Replaces Top & Bottom Navbars) */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-[fit-content] px-4 pointer-events-none">
        <motion.nav
          layout
          className="flex items-center gap-2 p-1.5 bg-[var(--surface)]/90 backdrop-blur-xl border border-[var(--border)] rounded-full shadow-[0_20px_40px_rgba(0,0,0,0.2)] pointer-events-auto"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = item.match(pathname);
            const isHovered = hoveredItem === item.href;
            const showLabel = isActive || isHovered;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onMouseEnter={() => setHoveredItem(item.href)}
                onMouseLeave={() => setHoveredItem(null)}
                className="relative outline-none"
              >
                <motion.div
                  layout
                  transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-full transition-colors duration-300 ${isActive
                      ? "bg-[var(--foreground)] text-[var(--background)]"
                      : "bg-transparent text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]"
                    }`}
                >
                  <motion.div layout>
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  </motion.div>

                  <AnimatePresence initial={false} mode="popLayout">
                    {showLabel && (
                      <motion.span
                        layout
                        initial={{ opacity: 0, scale: 0.8, filter: "blur(4px)", width: 0 }}
                        animate={{ opacity: 1, scale: 1, filter: "blur(0px)", width: "auto" }}
                        exit={{ opacity: 0, scale: 0.8, filter: "blur(4px)", width: 0 }}
                        transition={{ type: "spring", bounce: 0.1, duration: 0.4 }}
                        className="overflow-hidden whitespace-nowrap text-sm font-bold tracking-wide"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            className="ml-1 flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] p-3 text-[var(--foreground)] transition-colors hover:bg-[var(--surface)]"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </motion.nav>
      </div>

    </div>
  );
}