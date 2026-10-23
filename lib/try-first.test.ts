import { describe, expect, it } from "vitest";

import { parseTryFirst, serializeTryFirst } from "./try-first";

describe("try-first preference", () => {
  it("is off unless explicitly stored as on", () => {
    for (const raw of [null, undefined, "", "0", "true", "yes", "1 "]) {
      expect(parseTryFirst(raw), String(raw)).toBe(false);
    }
    expect(parseTryFirst("1")).toBe(true);
  });

  it("round-trips", () => {
    expect(parseTryFirst(serializeTryFirst(true))).toBe(true);
    expect(parseTryFirst(serializeTryFirst(false))).toBe(false);
  });
});
