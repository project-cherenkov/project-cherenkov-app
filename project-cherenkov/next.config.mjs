import createNextIntlPlugin from "next-intl/plugin";

// Points next-intl at the request-time config (locale detection, message loading).
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Velite writes generated content types/data into .velite/ at dev/build
  // time. It's run alongside Next via `concurrently` in package.json's
  // "dev"/"build" scripts, NOT through Velite's Next.js plugin hook — kept
  // as two plain, visible commands rather than a config-level integration,
  // so it's obvious to a new contributor what's actually running.
  experimental: {
    // MDX-derived pages can be heavy; keeps per-editorial bundles isolated
    // rather than pulled into a shared chunk (Non-Functional Requirements §8).
    optimizePackageImports: ["d3", "lucide-react"],
  },
};

export default withNextIntl(nextConfig);
