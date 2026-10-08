import { notFound } from "next/navigation";

// Catch-all so that any URL under a valid locale that matches no real page
// renders the localized, branded not-found.tsx (with header, footer and the
// right <html lang>) and a genuine 404 status — instead of falling through to
// Next's generic English 404. This is the pattern next-intl documents for
// localized 404s. It is a lowest-priority match: every real route wins over it.
export default function CatchAllPage() {
  notFound();
}
