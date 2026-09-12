import { decompress as zstdDecompress } from "fzstd";

/** Every zstd frame starts with this magic number. */
const ZSTD_MAGIC = [0x28, 0xb5, 0x2f, 0xfd];

function isZstd(bytes: Uint8Array): boolean {
  return ZSTD_MAGIC.every((byte, i) => bytes[i] === byte);
}

/** Decompresses when the blob is a zstd frame, otherwise hands it back as-is. */
function maybeUnzstd(bytes: Uint8Array): Uint8Array {
  if (!isZstd(bytes)) return bytes;
  try {
    return zstdDecompress(bytes) as Uint8Array;
  } catch {
    return bytes;
  }
}

/**
 * Reads the `name` of every entry in Anki's `MediaEntries` protobuf.
 *
 * The message is `MediaEntries { repeated MediaEntry entries = 1 }` with
 * `MediaEntry { string name = 1; uint32 size = 2; bytes sha1 = 3; ... }`, and
 * the Nth entry describes the archive member literally named "N". Only the
 * name matters here, so this reads the two fields it needs and skips the rest
 * rather than pulling in a protobuf runtime.
 */
function parseMediaEntries(bytes: Uint8Array): string[] {
  const names: string[] = [];
  const decoder = new TextDecoder();
  let offset = 0;

  function varint(): number {
    let result = 0;
    let shift = 0;
    while (offset < bytes.length) {
      const byte = bytes[offset++];
      result += (byte & 0x7f) * 2 ** shift;
      if ((byte & 0x80) === 0) return result;
      shift += 7;
      if (shift > 56) break;
    }
    throw new Error("truncated varint");
  }

  /** Advances past a field whose contents we do not care about. */
  function skip(wireType: number) {
    if (wireType === 0) varint();
    else if (wireType === 1) offset += 8;
    else if (wireType === 2) {
      // Read the length first: `offset += varint()` would capture the old
      // offset and throw away the bytes the varint itself consumed.
      const length = varint();
      offset += length;
    } else if (wireType === 5) offset += 4;
    else throw new Error(`unsupported wire type ${wireType}`);
  }

  while (offset < bytes.length) {
    const key = varint();
    const field = key >>> 3;
    const wireType = key & 7;

    if (field !== 1 || wireType !== 2) {
      skip(wireType);
      continue;
    }

    // One MediaEntry, read in its own window.
    const length = varint();
    const end = offset + length;
    if (end > bytes.length) throw new Error("truncated entry");

    let name = "";
    while (offset < end) {
      const innerKey = varint();
      const innerField = innerKey >>> 3;
      const innerWire = innerKey & 7;
      if (innerField === 1 && innerWire === 2) {
        const size = varint();
        name = decoder.decode(bytes.subarray(offset, offset + size));
        offset += size;
      } else {
        skip(innerWire);
      }
    }
    offset = end;
    names.push(name);
  }

  return names;
}

/**
 * Maps the filenames a note references ("cat.jpg") to the archive members that
 * hold them ("7"). Anki has shipped two manifest formats: a plain JSON object
 * of index to name in the legacy `.apkg`, and a zstd-compressed protobuf in
 * the one written since 2.1.50.
 */
export function readMediaManifest(
  files: Record<string, Uint8Array>,
): Map<string, string> {
  const manifest = new Map<string, string>();
  const raw = files["media"];
  if (!raw || raw.length === 0) return manifest;

  const bytes = maybeUnzstd(raw);

  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const [index, name] of Object.entries(parsed)) {
        if (typeof name === "string" && name) manifest.set(name, index);
      }
      return manifest;
    }
  } catch {
    // Not the legacy JSON manifest - fall through to the protobuf.
  }

  try {
    parseMediaEntries(bytes).forEach((name, index) => {
      if (name) manifest.set(name, String(index));
    });
  } catch {
    // An unreadable manifest means no media, not a failed import.
  }

  return manifest;
}

/**
 * Pulls one media file out of the archive. Members of a modern package are
 * individually zstd-compressed; legacy ones are stored as-is, and the frame
 * magic tells them apart without trusting the manifest's flags.
 */
export function readMediaFile(
  files: Record<string, Uint8Array>,
  entry: string,
): Uint8Array | null {
  const raw = files[entry];
  if (!raw || raw.length === 0) return null;
  return maybeUnzstd(raw);
}
