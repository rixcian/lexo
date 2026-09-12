import "server-only";

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ParseResult } from "./types";

export type Staged =
  | { kind: "csv"; filename: string; text: string }
  | { kind: "apkg"; filename: string; result: ParseResult };

const DIR = path.join(os.tmpdir(), "anki-import-staging");
const TTL_MS = 60 * 60 * 1000;

function ensureDir() {
  fs.mkdirSync(DIR, { recursive: true });
}

/** Drops staged uploads the user never confirmed. */
function prune() {
  if (!fs.existsSync(DIR)) return;
  const cutoff = Date.now() - TTL_MS;
  for (const name of fs.readdirSync(DIR)) {
    const file = path.join(DIR, name);
    try {
      if (fs.statSync(file).mtimeMs < cutoff) fs.rmSync(file, { force: true });
    } catch {
      // A concurrent prune already removed it.
    }
  }
}

function fileFor(token: string) {
  if (!/^[a-f0-9]{32}$/.test(token)) throw new Error("Invalid import token");
  return path.join(DIR, `${token}.json`);
}

export function stage(payload: Staged): string {
  ensureDir();
  prune();
  const token = crypto.randomBytes(16).toString("hex");
  fs.writeFileSync(fileFor(token), JSON.stringify(payload));
  return token;
}

export function read(token: string): Staged {
  const file = fileFor(token);
  if (!fs.existsSync(file)) {
    throw new Error("That upload expired. Pick the file again.");
  }
  return JSON.parse(fs.readFileSync(file, "utf8")) as Staged;
}

export function discard(token: string) {
  try {
    fs.rmSync(fileFor(token), { force: true });
  } catch {
    // Already gone.
  }
}
