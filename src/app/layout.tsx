import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import NavShell from "@/components/NavShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "RawMind",
  description: "Curated video feed and persona chat, in one place.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="antialiased dark"
      style={{ colorScheme: "dark" }}
      suppressHydrationWarning
    >
      <body
        className="min-h-[100dvh] overflow-x-hidden bg-[#09090b] text-zinc-100 font-sans selection:bg-white/20 selection:text-white"
        suppressHydrationWarning
      >
        <NavShell>{children}</NavShell>
        <Analytics />
      </body>
    </html>
  );
}