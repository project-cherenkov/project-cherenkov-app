import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import type { Editorial } from "#content";

const subjectLabel: Record<Editorial["subject"], string> = {
  informatics: "informatics",
  physics: "physics",
  astronomy: "astronomy",
};

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

  return (
    <Link
      href={`/archive/${editorial.subject}/${editorial.slug}`}
      className="group block rounded-lg border border-border bg-card p-5 transition-colors hover:border-cherenkov-blue-600 dark:hover:border-cherenkov-blue-pastel"
    >
      <span className="label-code inline-block rounded bg-muted px-2 py-0.5 text-brand">
        {subjectLabel[editorial.subject]}
      </span>
      {/* Only ever rendered for editors: public lists never contain archived
          editorials (lib/content.ts). */}
      {editorial.status === "archived" && (
        <span className="label-code ml-2 inline-block rounded border border-border-strong px-2 py-0.5 text-foreground">
          {t("archivedBadge")}
        </span>
      )}

      <Heading className="mt-3 text-lg font-semibold text-foreground group-hover:underline">
        {editorial.title}
      </Heading>
      {/* The principle slug can be 40+ characters. It sits under the title on
          one truncated line (full text on hover/focus via title) instead of
          wrapping into two lines of mono caps beside the subject chip. */}
      <p className="label-mono mt-1 truncate" title={editorial.principle}>
        {editorial.principle}
      </p>
      <p className="mt-1.5 text-sm text-foreground/75">{editorial.hook}</p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {editorial.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-cherenkov-pink/40 px-2.5 py-0.5 font-mono text-xs text-foreground dark:bg-cherenkov-pink/25"
          >
            {tag}
          </span>
        ))}
      </div>

      <p className="mt-4 text-xs text-foreground/75">
        {t("byAuthor", { author: editorial.author })}
      </p>
    </Link>
  );
}
