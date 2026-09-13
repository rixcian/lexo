"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Download, Home, Settings } from "lucide-react";
import { AccountMenu } from "@/components/account/account-menu";
import { Mascot } from "@/components/duo/mascot";
import { StreakChip, XpChip } from "@/components/duo/chips";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Learn", icon: Home },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/import", label: "Import", icon: Download },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export interface ShellUser {
  id: number;
  username: string;
}

export function AppShell({
  streakDays,
  streakLit,
  user,
  xpToday,
  children,
}: {
  streakDays: number;
  streakLit: boolean;
  /** Null on the sign-in and registration screens. */
  user: ShellUser | null;
  xpToday: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // A study session owns the whole screen - no chrome to distract from the card.
  if (pathname.startsWith("/study/")) {
    return <>{children}</>;
  }

  // Signed out there is nowhere to navigate to, so the header keeps only the
  // wordmark and the theme toggle, and the tab bar goes away entirely.
  if (!user) {
    return (
      <div className="flex min-h-dvh flex-col">
        <header className="flex h-[72px] shrink-0 items-center justify-between px-4 sm:px-6">
          <span className="flex items-center gap-2">
            <Mascot className="size-9" />
            <span className="type-h3 text-brand">lexo</span>
          </span>
          <ThemeToggle />
        </header>
        <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col px-4 pb-16 sm:px-6">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Section 4: sticky header, 72px, hairline bottom border */}
      <header className="sticky top-0 z-40 h-[72px] border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-full max-w-[1280px] items-center gap-4 px-4 sm:px-6">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 rounded-lg focus-visible:ring-3 focus-visible:ring-macaw focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
          >
            <Mascot className="size-9" />
            <span className="type-h3 text-brand">lexo</span>
          </Link>

          <nav className="ml-2 hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
                className={cn(
                  "type-label rounded-lg px-3 py-2 transition-colors focus-visible:ring-3 focus-visible:ring-macaw focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
                  isActive(pathname, item.href)
                    ? "bg-brand-tint text-brand-dark dark:text-brand"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <StreakChip days={streakDays} lit={streakLit} />
            <XpChip xp={xpToday} />
            <ThemeToggle />
            <AccountMenu userId={user.id} username={user.username} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pt-8 pb-28 sm:px-6 md:pb-16">
        {children}
      </main>

      {/* Section 10: nav collapses below 768px - a thumb-reachable tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background md:hidden">
        <ul className="mx-auto flex max-w-md items-stretch">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-[56px] flex-col items-center justify-center gap-1 py-2 transition-colors",
                    active ? "text-brand" : "text-muted-foreground",
                  )}
                >
                  <item.icon className="size-5" />
                  <span className="text-[11px] font-bold tracking-[0.02em]">
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
