// Guards the drizzle/ folder against the failure that left the snapshots
// stopped at 0005 while migrations 0006-0013 were written by hand: a
// migration that exists as SQL but has no snapshot makes `pnpm db:generate`
// diff against a stale picture and emit DDL for changes that are already
// applied. This test needs no database. The companion check
// (scripts/check-migration-drift.ts, `pnpm db:check`) proves the latest
// snapshot still matches lib/db/schema.ts.
//
// Rule: every migration is created by `pnpm db:generate`. See
// docs/engineering/database-migrations.md.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DRIZZLE = join(__dirname, "../../drizzle");
const META = join(DRIZZLE, "meta");

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}
interface Snapshot {
  id: string;
  prevId: string;
  version: string;
}

const journal = JSON.parse(readFileSync(join(META, "_journal.json"), "utf8")) as {
  entries: JournalEntry[];
};
const pad = (n: number) => String(n).padStart(4, "0");
const snapshotFile = (idx: number) => join(META, `${pad(idx)}_snapshot.json`);
const readSnapshot = (idx: number) => JSON.parse(readFileSync(snapshotFile(idx), "utf8")) as Snapshot;

// FROZEN. Migrations 0006-0013 were written by hand before this guard
// existed, so they have no snapshot of their own; 0014_schema_baseline records
// one snapshot for the schema as it stood after 0013. NEVER add to this range:
// a new migration without a snapshot is exactly the bug this test prevents.
const LEGACY_HAND_WRITTEN = { from: 6, to: 13 };
const BASELINE_IDX = 14;
const isLegacy = (idx: number) => idx >= LEGACY_HAND_WRITTEN.from && idx <= LEGACY_HAND_WRITTEN.to;

describe("drizzle migration folder integrity", () => {
  it("has a contiguous journal whose tags are NNNN_snake_case and match their index", () => {
    journal.entries.forEach((entry, position) => {
      expect(entry.idx, entry.tag).toBe(position);
      expect(entry.tag, entry.tag).toMatch(/^\d{4}_[a-z0-9_]+$/);
      expect(entry.tag.slice(0, 4), entry.tag).toBe(pad(entry.idx));
    });
    expect(new Set(journal.entries.map((e) => e.tag)).size).toBe(journal.entries.length);
  });

  it("has exactly one SQL file per journal entry, and no orphan SQL files", () => {
    const sql = readdirSync(DRIZZLE)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => f.slice(0, -4))
      .sort();
    expect(sql).toEqual(journal.entries.map((e) => e.tag).sort());
  });

  it("has strictly increasing `when` timestamps (drizzle applies only entries newer than the last one run)", () => {
    for (let i = 1; i < journal.entries.length; i++) {
      expect(journal.entries[i]!.when, journal.entries[i]!.tag).toBeGreaterThan(journal.entries[i - 1]!.when);
    }
  });

  it("has a snapshot for every migration outside the frozen hand-written range", () => {
    const missing = journal.entries
      .filter((e) => !isLegacy(e.idx) && !existsSync(snapshotFile(e.idx)))
      .map((e) => e.tag);
    expect(
      missing,
      `Migration(s) without a snapshot: ${missing.join(", ")}. Migrations must be created with \`pnpm db:generate\`, never by hand.`,
    ).toEqual([]);
  });

  it("has no snapshot without a journal entry, and none inside the frozen range", () => {
    const snapshots = readdirSync(META)
      .filter((f) => /^\d{4}_snapshot\.json$/.test(f))
      .map((f) => Number(f.slice(0, 4)));
    for (const idx of snapshots) {
      expect(journal.entries.some((e) => e.idx === idx), `snapshot ${pad(idx)} has no journal entry`).toBe(true);
      expect(isLegacy(idx), `snapshot ${pad(idx)} sits in the frozen hand-written range`).toBe(false);
    }
  });

  it("chains snapshots: each prevId is the previous snapshot's id, ids are unique", () => {
    const idxs = journal.entries.filter((e) => existsSync(snapshotFile(e.idx))).map((e) => e.idx);
    const snapshots = idxs.map(readSnapshot);
    expect(new Set(snapshots.map((s) => s.id)).size).toBe(snapshots.length);
    snapshots.forEach((snapshot, i) => {
      const expectedPrev = i === 0 ? "00000000-0000-0000-0000-000000000000" : snapshots[i - 1]!.id;
      expect(snapshot.prevId, `snapshot ${pad(idxs[i]!)}`).toBe(expectedPrev);
    });
  });

  it("keeps the baseline migration a no-op (its generated DDL was already applied by 0006-0013)", () => {
    const entry = journal.entries.find((e) => e.idx === BASELINE_IDX)!;
    const statements = readFileSync(join(DRIZZLE, `${entry.tag}.sql`), "utf8")
      .replace(/--.*$/gm, "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    expect(statements).toEqual(["SELECT 1"]);
  });
});
