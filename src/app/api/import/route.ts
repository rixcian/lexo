import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { parseImportUpload } from "@/lib/import/upload";
import { maxUploadBytes, tooLargeMessage } from "@/lib/import/limits";

export const dynamic = "force-dynamic";

/**
 * Takes the deck file and hands back a preview.
 *
 * A route handler rather than a server action: an action's body cap lives in
 * `next.config.ts`, which `next build` freezes into the standalone bundle, so
 * a prebuilt image could never be re-tuned from the environment. Route
 * handlers have no such cap, which leaves the limit ours to enforce.
 */
export async function POST(request: Request) {
  if (!(await currentUser())) {
    return NextResponse.json(
      { ok: false, error: "Sign in first." },
      { status: 401 },
    );
  }

  const limit = maxUploadBytes();

  // Refuse on the declared length before reading a single byte of the body.
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) {
    return NextResponse.json(
      { ok: false, error: tooLargeMessage() },
      { status: 413 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "That upload was not readable. Pick the file again." },
      { status: 400 },
    );
  }

  const result = await parseImportUpload(form.get("file"), limit);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
