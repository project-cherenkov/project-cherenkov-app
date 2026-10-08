import { getAllEditorials, getEditorial } from "@/lib/content";
import { OG_SIZE, renderOgImage } from "@/lib/og-image";
import en from "@/messages/en.json";
import id from "@/messages/id.json";

export const alt = "Cherenkov editorial";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return getAllEditorials().map(({ subject, slug }) => ({ subject, slug }));
}

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; subject: string; slug: string }>;
}) {
  const { locale, subject, slug } = await params;
  const messages = locale === "id" ? id : en;
  const editorial = getEditorial(subject, slug);
  const subjectName =
    (messages.syllabus.subjects as Record<string, string>)[subject] ?? subject;
  return renderOgImage({
    eyebrow: `${messages.site.name} · ${subjectName}`,
    title: editorial?.title ?? messages.site.name,
    footer: editorial?.hook ?? messages.site.tagline,
  });
}
