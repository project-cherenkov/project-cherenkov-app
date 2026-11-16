import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { humanizeSlug } from "@/lib/utils";
import { Chip } from "@/components/ui/chip";
import type { Editorial } from "#content";

const MAX_CARD_TAGS = 3;

// `headingLevel` keeps the document outline valid: 2 where the card sits
// directly under the page's <h1> (the archive listing), 3 (default) where it
// sits under an <h2> section (the home page's "recent editorials").
export function EditorialCard({
  editorial,
  headingLevel = 3,
}: {
  editorial: Editorial;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const t = useTranslations("editorial");
  const tSubjects = useTranslations("syllabus.subjects");

  return (
    <Link
      href={`/archive/${editorial.subject}/${editorial.slug}`}
      className="group flex h-full min-w-0 flex-col rounded-lg border border-border bg-card p-5 transition-colors hover:border-cherenkov-blue-600 dark:hover:border-cherenkov-blue-pastel"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Chip variant="subject" className="label-code text-brand">
          {tSubjects(editorial.subject)}
        </Chip>
        {/* Only ever rendered for editors: public lists never contain draft
            editorials (lib/content.ts). */}
        {editorial.status === "draft" && (
          <Chip variant="outline" className="label-code text-foreground">
            {t("draftBadge")}
          </Chip>
        )}
      </div>

      <Heading className="mt-3 text-lg font-semibold text-foreground group-hover:underline">
        {editorial.title}
      </Heading>
      <p className="mt-1.5 text-sm text-foreground/75">{editorial.hook}</p>
      {/* The error type, not the principle, is the line that tells a reader
          what they will learn to avoid ("filed by the mistake it corrects").
          It wraps rather than being cut off with an ellipsis. */}
      {editorial.errorType && (
        <p className="mt-2 border-l-2 border-cherenkov-pink-500 pl-2 text-sm font-medium text-foreground [overflow-wrap:anywhere]">
          {humanizeSlug(editorial.errorType)}
        </p>
      )}

      {/* Tags are for discovery, so they stay on the card: readable labels
          (not raw slugs in mono), quiet pink from the `chip` token (still pink
          in dark mode), at most three, with the rest counted. The full set is
          on the editorial page, where each tag links to the archive filter. */}
      {editorial.tags.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-1.5" aria-label={t("sections.tags")}>
          {editorial.tags.slice(0, MAX_CARD_TAGS).map((tag) => (
            <li key={tag}>
              <Chip variant="tag">{humanizeSlug(tag)}</Chip>
            </li>
          ))}
          {editorial.tags.length > MAX_CARD_TAGS && (
            <li>
              <span className="inline-block px-1 py-0.5 text-xs text-muted-foreground">
                {t("moreTags", { count: editorial.tags.length - MAX_CARD_TAGS })}
              </span>
            </li>
          )}
        </ul>
      )}

      <p className="mt-auto pt-4 text-xs text-foreground/75">
        {t("byAuthor", { author: editorial.author })}
      </p>
    </Link>
  );
}
