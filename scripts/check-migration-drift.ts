// `pnpm db:check` — fails when drizzle/ does not match lib/db/schema.ts.
//
// Runs `drizzle-kit generate` into the real drizzle/ folder and then removes
// whatever it wrote. If generate produces ANYTHING, the latest snapshot is out
// of step with the schema: someone changed schema.ts without generating a
// migration, or hand-wrote a migration that does not match. It needs no
// database connection and changes nothing when the check passes or fails.
//
//   pnpm db:check
//
// Fix a failure with `pnpm db:generate --name=<short_description>` (see
// docs/engineering/database-migrations.md).
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const DRIZZLE = resolve("drizzle");

function listFiles(dir: string, base = dir): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full, base) : [full.slice(base.length + 1)];
  });
}

if (!existsSync(DRIZZLE)) {
  console.error("db:check: no drizzle/ folder found. Run it from the repository root.");
  process.exit(2);
}

// Back up the folder so a failed or interrupted run can always be undone.
const backup = mkdtempSync(join(tmpdir(), "drizzle-check-"));
cpSync(DRIZZLE, backup, { recursive: true });
const before = new Set(listFiles(DRIZZLE));

let exitCode = 0;
try {
  try {
    execFileSync("pnpm", ["exec", "drizzle-kit", "generate", "--name=db_check_should_not_exist"], {
      // No terminal on stdin: if drizzle-kit would ask a question (for example
      // "was this column renamed?") it fails instead of hanging CI.
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120_000,
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL ?? "postgres://unused:unused@localhost:5432/unused" },
    });
  } catch (error) {
    const e = error as { stdout?: Buffer; stderr?: Buffer; message: string };
    console.error("db:check: `drizzle-kit generate` did not complete.");
    console.error(String(e.stderr ?? e.stdout ?? e.message).trim());
    exitCode = 2;
  }

  if (exitCode === 0) {
    const created = listFiles(DRIZZLE).filter((file) => !before.has(file));
    if (created.length > 0) {
      console.error("db:check FAILED: drizzle/ does not match lib/db/schema.ts.");
      console.error("`drizzle-kit generate` wanted to create:");
      for (const file of created) console.error(`  drizzle/${file}`);
      console.error(
        "\nEither schema.ts changed without a generated migration, or a migration was written by hand and\n" +
          "does not match the schema. Run `pnpm db:generate --name=<short_description>` and commit the SQL,\n" +
          "snapshot and journal together. Never create files in drizzle/ by hand.",
      );
      exitCode = 1;
    } else {
      console.log("db:check OK: drizzle/ matches lib/db/schema.ts.");
    }
  }
} finally {
  // Restore exactly what was there before, whatever happened.
  rmSync(DRIZZLE, { recursive: true, force: true });
  cpSync(backup, DRIZZLE, { recursive: true });
  rmSync(backup, { recursive: true, force: true });
}
process.exit(exitCode);
