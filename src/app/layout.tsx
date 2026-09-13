import type { Metadata, Viewport } from "next";
import { Lexend_Deca } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { PwaRegister } from "@/components/pwa-register";
import { themeInitScript } from "@/components/theme-toggle";
import { ToastProvider } from "@/components/ui/toast";
import { currentUser } from "@/lib/auth/session";
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

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Null on the sign-in and registration screens, which render in the same
  // shell with its chrome stripped back.
  const user = await currentUser();
  const today = user ? todaySummary(user.id) : null;
  const days = user ? streak(user.id) : null;

  return (
    <html lang="en" className={lexend.variable} suppressHydrationWarning>
      <head>
        {/* Applied before paint so the dark canvas never flashes white. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased">
        <ToastProvider position="bottom-center">
          <AppShell
            streakDays={days?.current ?? 0}
            streakLit={days?.litToday ?? false}
            user={user && { id: user.id, username: user.username }}
            xpToday={today?.xp ?? 0}
          >
            {children}
          </AppShell>
        </ToastProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
