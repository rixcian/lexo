import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

export const DB_PATH =
  process.env.ANKI_DB_PATH ?? path.join(process.cwd(), "data", "anki.db");

const MIGRATIONS_FOLDER =
  process.env.ANKI_MIGRATIONS_DIR ?? path.join(process.cwd(), "drizzle");

type Connection = {
  database: ReturnType<typeof drizzle<typeof schema>>;
  sqlite: Database.Database;
};

/**
 * The usual cause of SQLITE_CANTOPEN is a bind mount the container user cannot
 * write to - Docker creates a missing host directory as root, while the image
 * runs as uid 1000. Turn that into an instruction instead of a stack trace.
 */
function mountDiagnostics(dir: string): string {
  const uid = typeof process.getuid === "function" ? process.getuid() : null;
  const gid = typeof process.getgid === "function" ? process.getgid() : null;

  let owner = "does not exist";
  try {
    const stat = fs.statSync(dir);
    const mode = (stat.mode & 0o777).toString(8);
    owner = `owned by ${stat.uid}:${stat.gid}, mode ${mode}`;
  } catch {
    // Left as "does not exist".
  }

  return [
    `[db] cannot open the database at ${DB_PATH}`,
    `[db]   directory ${dir} is ${owner}`,
    `[db]   this process runs as ${uid ?? "?"}:${gid ?? "?"}`,
    `[db]   fix: chown -R ${uid ?? 1000}:${gid ?? 1000} <the host path mounted at ${dir}>`,
    `[db]   on an SELinux host, add :z to the volume line as well`,
    `[db]   or point ANKI_DB_PATH somewhere this user can write`,
  ].join("\n");
}

function connect(): Connection {
  const dir = path.dirname(DB_PATH);

  try {
    fs.mkdirSync(/* turbopackIgnore: true */ dir, { recursive: true });
    // W_OK alone is not enough: SQLite also creates -wal and -shm siblings.
    fs.accessSync(dir, fs.constants.W_OK | fs.constants.X_OK);
  } catch {
    console.error(mountDiagnostics(dir));
    throw new Error(
      `The database directory ${dir} is not writable by this user. See the log above.`,
    );
  }

  const connection = new Database(DB_PATH);
  // WAL keeps reads non-blocking while a study session writes review rows.
  connection.pragma("journal_mode = WAL");
  connection.pragma("foreign_keys = ON");
  connection.pragma("busy_timeout = 5000");

  const database = drizzle(connection, { schema });

  if (fs.existsSync(/* turbopackIgnore: true */ MIGRATIONS_FOLDER)) {
    migrate(database, { migrationsFolder: MIGRATIONS_FOLDER });
  } else {
    console.warn(
      `[db] migrations folder not found at ${MIGRATIONS_FOLDER} - skipping migrate()`,
    );
  }

  return { database, sqlite: connection };
}

// Next dev re-evaluates modules on every HMR pass; without a global cache each
// pass would open another handle to the same file.
const globalForDb = globalThis as unknown as { __ankiDb?: Connection };

/**
 * Opened on first use, never at module evaluation - `next build` imports these
 * modules while collecting page data and must not touch (or lock) the file.
 */
function connection(): Connection {
  return (globalForDb.__ankiDb ??= connect());
}

function lazy<T extends object>(pick: (c: Connection) => T): T {
  return new Proxy({} as T, {
    get(_target, property) {
      const real = pick(connection()) as Record<string | symbol, unknown>;
      const value = real[property];
      return typeof value === "function" ? value.bind(real) : value;
    },
    has(_target, property) {
      return property in (pick(connection()) as object);
    },
  });
}

export const db = lazy((c) => c.database);
export const sqlite = lazy((c) => c.sqlite);
export { schema };
