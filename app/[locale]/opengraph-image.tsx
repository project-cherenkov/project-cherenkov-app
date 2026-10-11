import { routing } from "@/i18n/routing";
import en from "@/messages/en.json";
import id from "@/messages/id.json";
import { OG_SIZE, renderOgImage } from "@/lib/og-image";

export const alt = "Cherenkov — interactive olympiad editorials";
export const size = OG_SIZE;
export const contentType = "image/png";

// Render once at build time per locale instead of on every request.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// One site-wide card per locale (inherited by every page under /[locale]
// that doesn't define its own). Text comes from the same message catalogues
// as the rest of the site: the home headline, a one-line description, and
// the three subjects as chips. The long tagline is deliberately not used —
// at card size it becomes a wall of text.
export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const messages = locale === "id" ? id : en;
  return renderOgImage({
    display: true,
    title: messages.home.heroTitle,
    description: messages.site.ogDescription,
    chips: Object.values(messages.syllabus.subjects),
  });
}
