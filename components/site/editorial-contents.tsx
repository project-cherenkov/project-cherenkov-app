"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { createSlugger } from "@/lib/docs-headings";

type Entry = { id: string; title: string };

// In-page navigation for a long editorial. The compiled MDX has no heading ids
// (only the docs add them at build time), so this reads the rendered <h2>s of
// the article body on mount, stamps an id on any that lacks one, and lists
// them. Server HTML renders nothing: the editorial reads the same without it,
// so a failure here costs a convenience, not content.
//
// `variant="rail"` is the sticky list beside the text at `xl`; `variant="jump"`
// is the short inline row shown under the title below `xl`.
export function EditorialContents({
  bodyId,
  variant,
}: {
  bodyId: string;
  variant: "rail" | "jump";
}) {
  const t = useTranslations("editorial");
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    const body = document.getElementById(bodyId);
    if (!body) return;
    const slug = createSlugger();
    const found: Entry[] = [];
    body.querySelectorAll<HTMLHeadingElement>("h2").forEach((heading) => {
      const title = (heading.textContent ?? "").trim();
      if (!title) return;
      if (!heading.id) heading.id = slug(title);
      found.push({ id: heading.id, title });
    });
    setEntries(found);
  }, [bodyId]);

  if (entries.length < 2) return null;

  if (variant === "jump") {
    return (
      <nav aria-label={t("contentsLabel")} className="mt-4 xl:hidden">
        <ul className="flex flex-wrap gap-x-4 text-sm">
          {entries.map((entry) => (
            <li key={entry.id}>
              <a
                href={`#${entry.id}`}
                className="inline-flex min-h-6 items-center text-brand underline underline-offset-4 hover:text-foreground"
              >
                {entry.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  return (
    <nav aria-label={t("contentsLabel")} className="sticky top-24 hidden max-h-[calc(100dvh-8rem)] overflow-y-auto text-sm xl:block">
      <p className="font-heading font-semibold text-foreground">{t("contentsLabel")}</p>
      <ul className="mt-2 space-y-1 border-l border-border pl-3">
        {entries.map((entry) => (
          <li key={entry.id}>
            <a
              href={`#${entry.id}`}
              className="inline-flex min-h-6 items-center text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {entry.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
