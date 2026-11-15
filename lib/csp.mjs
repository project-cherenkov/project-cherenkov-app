// T12. Content-Security-Policy, REPORT-ONLY.
//
// Report-only means the browser logs what the policy WOULD have blocked in the
// DevTools console and blocks nothing. This ships first so the policy can be
// watched against the real site; it is not to be turned into an enforcing
// header until each surface below has been exercised with the console open and
// every legitimate violation has been dealt with:
//   - /keystatic (the Keystatic admin UI, GitHub mode: api.github.com, avatars)
//   - team photos and other images on Vercel Blob (*.public.blob.vercel-storage.com)
//   - KaTeX-rendered maths (inline styles, bundled fonts)
//   - the Blockly scene builder (inline styles, data: images, possible blob: workers)
//   - the Next.js hydration scripts (inline, hence 'unsafe-inline' for now)
// There is deliberately no report-uri / report-to: collecting reports would need
// an endpoint and a retention decision, which is out of scope here.
//
// Kept as plain .mjs because next.config.mjs imports it; lib/csp.d.mts types it.
export const CSP_HEADER_NAME = "Content-Security-Policy-Report-Only";

export function buildContentSecurityPolicy({ isProduction }) {
  const scriptSrc = ["'self'", "'unsafe-inline'"];
  // Next's dev server (React Refresh) evaluates code; production does not.
  if (!isProduction) scriptSrc.push("'unsafe-eval'");

  const directives = {
    "default-src": ["'self'"],
    "script-src": scriptSrc,
    // Tailwind/KaTeX/Blockly all set inline styles.
    "style-src": ["'self'", "'unsafe-inline'"],
    // Any https image: team photo URLs are editable content on arbitrary hosts.
    "img-src": ["'self'", "data:", "blob:", "https:"],
    // next/font self-hosts fonts at build time; KaTeX fonts are bundled.
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", "https://api.github.com", "https://*.public.blob.vercel-storage.com"],
    "worker-src": ["'self'", "blob:"],
    "media-src": ["'self'", "blob:", "data:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    // Matches the existing X-Frame-Options: SAMEORIGIN.
    "frame-ancestors": ["'self'"],
  };

  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}
