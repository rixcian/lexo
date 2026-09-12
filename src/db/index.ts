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

function connect(): Connection {
  fs.mkdirSync(/* turbopackIgnore: true */ path.dirname(DB_PATH), {
    recursive: true,
  });

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
