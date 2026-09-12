import { NextResponse } from "next/server";
import { count } from "drizzle-orm";
import { db } from "@/db";
import { decks } from "@/db/schema";

export const dynamic = "force-dynamic";

/** Container health check - proves the process is up and SQLite is readable. */
export function GET() {
  try {
    const n = db.select({ n: count() }).from(decks).get()?.n ?? 0;
    return NextResponse.json({ ok: true, decks: n });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "unknown" },
      { status: 503 },
    );
  }
}
