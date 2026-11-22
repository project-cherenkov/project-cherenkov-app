import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// An undefined var() is silently invalid at computed-value time: `fill` falls
// back to black. This is how every trail particle once turned black.
const css = readFileSync(join(__dirname, "../app/globals.css"), "utf8");

describe("globals.css custom properties", () => {
  it("defines every --mf-* and --nt-* property that it uses", () => {
    const defined = new Set([...css.matchAll(/(--(?:mf|nt)-[\w-]+)\s*:/g)].map((m) => m[1]));
    const used = new Set([...css.matchAll(/var\((--(?:mf|nt)-[\w-]+)/g)].map((m) => m[1]));
    const missing = [...used].filter((name) => !defined.has(name));
    expect(missing).toEqual([]);
  });
});
