# Security headers and security.txt

Written 2026-11-14. Code wins: see `lib/csp.mjs`, `next.config.mjs` and `public/.well-known/security.txt`.

## Content-Security-Policy (report-only)

The site sends `Content-Security-Policy-Report-Only`. A report-only policy makes the browser LOG what it would have blocked in the DevTools console and blocks nothing, so it cannot break the site. There is no enforcing policy, and none should be added until the steps below are done. There is also no report endpoint: violations are read in the browser console.

Before tightening, load each of these with the console open (Console, filter for "Content Security Policy") and note every violation that comes from something the site legitimately needs:

1. `/keystatic`, signed in with GitHub: the admin UI, the GitHub API calls and avatars.
2. A page with team photos and any other Vercel Blob image.
3. A page with KaTeX maths.
4. The scene builder (Blockly): inline styles, `data:` images, any `blob:` workers.
5. A normal page, once in production mode and once with `pnpm dev` (development allows `eval` for React Refresh; production does not).

`script-src` currently allows `'unsafe-inline'` because Next.js emits inline hydration scripts. Removing it needs per-request nonces, which is a larger change.

## security.txt

`public/.well-known/security.txt` follows RFC 9116 and is served as a plain static file: the middleware matcher skips any path containing a dot, so next-intl never rewrites it, and `app/robots.ts` does not block it.

- `Contact:` is the placeholder `mailto:[PLACEHOLDER: contact email]` until the owner supplies the address.
- `Expires:` is `2027-11-14`. Renew it (and move the date a year forward) before it passes; an expired security.txt is treated as unmaintained.

## Related

- [email-and-domain.md](email-and-domain.md)
- [account-email-flows.md](account-email-flows.md)
