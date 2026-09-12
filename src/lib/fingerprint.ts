import { createHash } from "node:crypto";

/**
 * Stable identity for a note within a deck. Whitespace and case are normalized
 * so re-importing a slightly reformatted CSV does not duplicate every row.
 *
 * Media on the front or the back counts towards identity: a picture deck can
 * have many cards whose text is empty, and those are not duplicates of each
 * other. Notes without media hash exactly as they did before media existed, so
 * fingerprints already in the database stay valid.
 */
export function fingerprint(
  front: string,
  back: string,
  mediaHashes: string[] = [],
): string {
  const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  const hash = createHash("sha1").update(`${norm(front)}\u0000${norm(back)}`);
  for (const media of [...mediaHashes].sort()) hash.update(`\u0000${media}`);
  return hash.digest("hex");
}
