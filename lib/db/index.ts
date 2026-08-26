import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type Database = ReturnType<typeof drizzle<typeof schema>>;

let cached: Database | null = null;

// DB-001 constraint: must not throw at import time when DATABASE_URL is
// unset — Phase 1's own build has to keep succeeding with zero env vars
// (spec §2). The Neon client / Drizzle instance is only actually
// constructed the first time a caller reads a property off `db` (i.e. the
// first real query), not when this module is loaded.
function getDb(): Database {
  if (cached) return cached;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Phase 2 features (auth, quizzes, the study " +
        "planner) need it — see .env.example. Phase 1's archive doesn't use " +
        "the database at all, so if you're seeing this from an archive page " +
        "something imported lib/db that shouldn't have.",
    );
  }

  const sql = neon(url);
  cached = drizzle(sql, { schema });
  return cached;
}

// A Proxy so every call site can keep writing `db.select()...` /
// `db.insert()...` exactly as Drizzle's own docs show, while construction
// itself stays deferred to first real use (see getDb() above). Every
// property access funnels through getDb(), so the lazy-construction and
// missing-DATABASE_URL error both happen at the same single point.
export const db: Database = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export type { Database };
