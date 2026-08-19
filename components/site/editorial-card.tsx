import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import type { Editorial } from "#content";

const subjectLabel: Record<Editorial["subject"], string> = {
  informatics: "informatics",
  physics: "physics",
  astronomy: "astronomy",
};

export function EditorialCard({ editorial }: { editorial: Editorial }) {
  const t = useTranslations("editorial");

  return (
    <Link
      href={`/archive/${editorial.subject}/${editorial.slug}`}
      className="group block rounded-lg border border-slate-200 bg-white p-5 transition-colors hover:border-cherenkov-blue-pastel"
    >
      <div className="flex items-center gap-2">
        <span className="label-code rounded bg-slate-100 px-2 py-0.5 text-cherenkov-blue-pastel">
          {subjectLabel[editorial.subject]}
        </span>
        <span className="label-code">{editorial.principle}</span>
      </div>

      <h3 className="mt-3 text-lg font-semibold text-slate-900 group-hover:underline">
        {editorial.title}
      </h3>
      <p className="mt-1.5 text-sm text-slate-600">{editorial.hook}</p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {editorial.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-cherenkov-pink/40 px-2.5 py-0.5 font-mono text-[11px] text-slate-700"
          >
            {tag}
          </span>
        ))}
      </div>

      <p className="mt-4 text-xs text-slate-400">
        {t("byAuthor", { author: editorial.author })}
      </p>
    </Link>
  );
}
