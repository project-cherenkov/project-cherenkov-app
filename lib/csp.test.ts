import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CSP_HEADER_NAME, buildContentSecurityPolicy } from "./csp.mjs";

describe("content security policy (T12, report-only)", () => {
  it("is sent under the Report-Only header name", () => {
    expect(CSP_HEADER_NAME).toBe("Content-Security-Policy-Report-Only");
  });

  it("next.config.mjs never sends an enforcing Content-Security-Policy header", () => {
    const config = readFileSync("next.config.mjs", "utf8");
    expect(config).toContain("CSP_HEADER_NAME");
    // The only CSP header key allowed is the constant; no literal enforcing key.
    expect(config).not.toMatch(/["']Content-Security-Policy["']/);
  });

  it("allows the hosts the site really uses", () => {
    const policy = buildContentSecurityPolicy({ isProduction: true });
    expect(policy).toContain("connect-src 'self' https://api.github.com https://*.public.blob.vercel-storage.com");
    expect(policy).toMatch(/img-src [^;]*https:/);
    expect(policy).toMatch(/img-src [^;]*data:/);
    expect(policy).toMatch(/worker-src [^;]*blob:/);
  });

  it("locks down plugins, base URI, form targets and framing", () => {
    const policy = buildContentSecurityPolicy({ isProduction: true });
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain("form-action 'self'");
    expect(policy).toContain("frame-ancestors 'self'");
  });

  it("allows eval only outside production", () => {
    expect(buildContentSecurityPolicy({ isProduction: true })).not.toContain("'unsafe-eval'");
    expect(buildContentSecurityPolicy({ isProduction: false })).toContain("'unsafe-eval'");
  });

  it("has no report endpoint", () => {
    const policy = buildContentSecurityPolicy({ isProduction: true });
    expect(policy).not.toMatch(/report-uri|report-to/);
  });
});
