import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { config } from "../middleware";
import robots from "../app/robots";

// T10. /.well-known/security.txt must be served as the plain static file, not
// routed through next-intl, and crawlers must be allowed to read it.
const file = readFileSync("public/.well-known/security.txt", "utf8");

describe("security.txt", () => {
  it("has the two required RFC 9116 fields", () => {
    expect(file).toMatch(/^Contact: mailto:.+$/m);
    expect(file).toMatch(/^Expires: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/m);
  });

  it("expires about a year after it was written (renew it before then)", () => {
    const expires = new Date(/^Expires: (.+)$/m.exec(file)![1]!).getTime();
    const written = new Date("2026-11-14T00:00:00Z").getTime();
    const days = (expires - written) / 86_400_000;
    expect(days).toBeGreaterThan(300);
    expect(days).toBeLessThan(400);
  });

  it("is not matched by the middleware, so next-intl never rewrites it", () => {
    const pattern = new RegExp(`^${config.matcher[0]}$`);
    expect(pattern.test("/.well-known/security.txt")).toBe(false);
    // Sanity: an ordinary page IS matched.
    expect(pattern.test("/id/about")).toBe(true);
  });

  it("is not blocked by robots.txt", () => {
    // robots.txt rules are prefix matches where * stands for any characters.
    const blocks = (pattern: string, path: string) =>
      new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}`).test(path);
    expect(blocks("/*/login", "/id/login")).toBe(true); // the matcher itself works
    expect(blocks("/*/login", "/.well-known/security.txt")).toBe(false);

    const rules = robots().rules;
    const list = Array.isArray(rules) ? rules : [rules];
    for (const rule of list) {
      const disallow = ([] as string[]).concat((rule as { disallow?: string | string[] }).disallow ?? []);
      for (const pattern of disallow) {
        expect(blocks(pattern, "/.well-known/security.txt"), `blocked by ${pattern}`).toBe(false);
      }
    }
  });
});
