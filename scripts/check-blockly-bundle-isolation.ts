#!/usr/bin/env tsx
/**
 * PROG-006 — the second of this feature's two "prove the design assumption
 * holds" checks (the other is components/viz/programmable-scene/no-eval.test.ts).
 *
 * viz-engine.tsx loads ProgrammableScene via next/dynamic with ssr:false,
 * which is what's supposed to keep Blockly — a large, authoring-only
 * dependency pulled in transitively by
 * components/site/scene-builder/block-editor.tsx — out of every
 * reader-facing page's JS payload. This script checks that assumption
 * against a real production build's actual output, rather than trusting
 * that the dynamic-import boundary was drawn correctly.
 *
 * Run after `next build` — chained onto the "build" script in package.json
 * (this repo has no separate "checks" CI job; every build-time check runs
 * as part of the same `pnpm build` step CI already has, which is what
 * "wired into CI the same way this repo's other build-time checks are"
 * means here).
 *
 * Marker: "program_emit_element", a Blockly block type name defined only
 * in block-editor.tsx. Deliberately not the generic string "Blockly" —
 * that could in principle appear in an unrelated license banner or
 * comment bundled from some other package, which would make this check
 * noisy and eventually ignored. A block type name we invented ourselves
 * has no such false-positive risk.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const CHUNKS_ROOT = path.join(process.cwd(), ".next", "static", "chunks");
const MARKER = "program_emit_element";
// Reader-facing pages all live under the [locale] segment (see
// app/[locale]/**) — archive, planner, about, home, etc. This is the one
// place the marker must never appear.
const READER_ROUTE_DIR = path.join(CHUNKS_ROOT, "app", "[locale]");

function walkJsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walkJsFiles(full));
    } else if (entry.endsWith(".js")) {
      out.push(full);
    }
  }
  return out;
}

function fail(message: string): never {
  console.error(`PROG-006 FAILED: ${message}`);
  process.exit(1);
}

function main() {
  try {
    statSync(CHUNKS_ROOT);
  } catch {
    fail(`${CHUNKS_ROOT} not found — run "next build" before this check.`);
  }

  const allChunks = walkJsFiles(CHUNKS_ROOT);
  const matches = allChunks.filter((file) => readFileSync(file, "utf8").includes(MARKER));

  if (matches.length === 0) {
    fail(
      `expected to find "${MARKER}" in at least one build chunk (the scene builder's own) but found ` +
        `none — either the scene builder page didn't build, or the marker string no longer matches ` +
        `block-editor.tsx's actual source, in which case this script needs updating too, not just ` +
        "silently passing.",
    );
  }

  const leakedToReaderRoute = matches.filter((file) => file.startsWith(READER_ROUTE_DIR));
  // A chunk shared across every route (Next's "First Load JS shared by
  // all") lives directly under .next/static/chunks/, not under
  // .../app/<route>/ at all — leaking there would be even worse than
  // leaking into one reader route, since it would load on literally every
  // page.
  const leakedToSharedChunk = matches.filter((file) => !file.includes(`${path.sep}app${path.sep}`));

  const leaks = [...leakedToReaderRoute, ...leakedToSharedChunk];
  if (leaks.length > 0) {
    fail(
      `Blockly (via the "${MARKER}" marker) reached a reader-facing or shared bundle:\n` +
        leaks.map((f) => `  ${f}`).join("\n"),
    );
  }

  console.log(
    `PROG-006 OK: "${MARKER}" found only in ${matches.length} scene-builder-specific chunk(s), ` +
      "never under a reader route or a shared chunk:",
  );
  for (const file of matches) console.log(`  ${path.relative(process.cwd(), file)}`);
}

main();
