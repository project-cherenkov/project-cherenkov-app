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
      <div className="flex items-center gap-2">
        <span className="label-code rounded bg-slate-100 px-2 py-0.5 text-cherenkov-blue-800 dark:bg-slate-800 dark:text-cherenkov-blue-pastel">
          {subjectLabel[editorial.subject]}
        </span>
        <span className="label-code">{editorial.principle}</span>
      </div>

      <Heading className="mt-3 text-lg font-semibold text-foreground group-hover:underline">
        {editorial.title}
      </Heading>
      <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{editorial.hook}</p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {editorial.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-cherenkov-pink/40 px-2.5 py-0.5 font-mono text-[11px] text-slate-800 dark:bg-cherenkov-pink/25 dark:text-slate-100"
          >
            {tag}
          </span>
        ))}
      </div>

      <p className="mt-4 text-xs text-slate-600 dark:text-slate-300">
        {t("byAuthor", { author: editorial.author })}
      </p>
    </Link>
  );
}
