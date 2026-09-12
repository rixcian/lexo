import type { Metadata, Viewport } from "next";
import { Lexend_Deca } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { PwaRegister } from "@/components/pwa-register";
import { themeInitScript } from "@/components/theme-toggle";
import { ToastProvider } from "@/components/ui/toast";
import { streak, todaySummary } from "@/lib/stats";
import "./globals.css";

// DESIGN.md section 3: Lexend Deca's hyper-legibility is the deliberate body
// choice for second-language readers - do not swap it for Inter.
const lexend = Lexend_Deca({
  subsets: ["latin"],
  variable: "--font-lexend",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "lexo - spaced repetition",
    template: "%s - lexo",
  },
  description:
    "A self-hosted flashcard app with FSRS scheduling, deck import and study stats.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "lexo",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

// Every page reads live SQLite state, so nothing here is prerenderable.
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1f1f1f" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const today = todaySummary();
  const days = streak();

  return (
    <html lang="en" className={lexend.variable} suppressHydrationWarning>
      <head>
        {/* Applied before paint so the dark canvas never flashes white. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased">
        <ToastProvider position="bottom-center">
          <AppShell
            streakDays={days.current}
            streakLit={days.litToday}
            xpToday={today.xp}
          >
            {children}
          </AppShell>
        </ToastProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
