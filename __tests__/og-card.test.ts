import { describe, expect, it } from "vitest";

import { OG_COLORS } from "@/lib/og-card";
import config from "@/tailwind.config";

// The social card repeats a few brand hexes (importing tailwind.config.ts into
// the route bundle would drag the typography plugin along). This keeps the two
// in step: change a brand colour in tailwind.config.ts and this fails until
// lib/og-card.tsx follows.
type Scale = Record<string, string>;
const brand = (config.theme?.extend?.colors as Record<string, Record<string, string | Scale>>)
  .cherenkov!;
const blue = brand.blue as Scale;
const pink = brand.pink as Scale;

describe("social card colours", () => {
  it("match the brand tokens in tailwind.config.ts", () => {
    expect(OG_COLORS.ink).toBe(brand.ink);
    expect(OG_COLORS.cream).toBe(brand.cream);
    expect(OG_COLORS.blue).toBe(blue.DEFAULT);
    expect(OG_COLORS.blue300).toBe(blue["300"]);
    expect(OG_COLORS.pink).toBe(pink.DEFAULT);
  });
});
