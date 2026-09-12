import path from "node:path";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.ANKI_DB_PATH ?? path.join(process.cwd(), "data", "anki.db"),
  },
});
