import { defineConfig } from "drizzle-kit";

// DB-001: Drizzle Kit's own config for `pnpm db:generate` / `pnpm db:migrate`.
// This file is a CLI-time concern (drizzle-kit reads it directly when you
// run those commands) — it is never imported by the app itself, so unlike
// lib/db/index.ts it doesn't need to defer reading DATABASE_URL. Leaving it
// empty-string-when-unset (rather than throwing) just means running
// `pnpm db:generate`/`db:migrate` with no DATABASE_URL fails with Drizzle
// Kit's own clear connection error instead of a confusing one from here.
export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
