"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { Link } from "@/i18n/routing";

export interface MaterialNavTopic {
  id: string;
  name: string;
  // null when no material has been written for this topic yet.
  href: string | null;
  current: boolean;
}

export interface MaterialNavSection {
  id: string;
  name: string;
  topics: MaterialNavTopic[];
}

export interface MaterialNavLabels {
  heading: string;
  toggle: string;
  comingSoon: string;
}

// Chapter sidebar for a material page (R1). Follows the syllabus order.
// Topics without a material are shown greyed with "coming soon" rather than
// hidden: that is honest about how much of the syllabus is covered, and it
// shows a student where the gaps are. (Hiding them is a one-line change here
// if the owner prefers a cleaner list.)
//
// Desktop: always visible. Below the `lg` breakpoint it becomes a disclosure
// that starts closed, so it never pushes the article down the page.
export function MaterialNav({
  sections,
  labels,
}: {
  sections: MaterialNavSection[];
  labels: MaterialNavLabels;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:sticky lg:top-16 lg:max-h-[calc(100vh-5rem)] lg:self-start lg:overflow-y-auto">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls="material-nav"
        className="flex min-h-11 w-full items-center justify-between rounded-md border border-border px-3 font-mono text-xs uppercase tracking-wide text-foreground lg:hidden"
      >
        {labels.toggle}
        <ChevronDown
          aria-hidden
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <nav
        id="material-nav"
        aria-label={labels.heading}
        className={`${open ? "block" : "hidden"} mt-3 lg:mt-0 lg:block`}
      >
        <p className="label-code mb-3 hidden lg:block">{labels.heading}</p>
        <ul className="space-y-2">
          {sections.map((section) => (
            <li key={section.id}>
              <details open={section.topics.some((topic) => topic.current)} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded px-1 py-1.5 text-sm font-semibold text-foreground hover:bg-muted">
                  <span>{section.name}</span>
                  <ChevronDown
                    aria-hidden
                    className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180"
                  />
                </summary>
                <ul className="mt-1 space-y-0.5 border-l border-border pl-3">
                  {section.topics.map((topic) => (
                    <li key={topic.id}>
                      {topic.href ? (
                        <Link
                          href={topic.href}
                          aria-current={topic.current ? "page" : undefined}
                          className={[
                            "block rounded px-2 py-1 text-sm",
                            topic.current
                              ? "bg-foreground font-medium text-background"
                              : "text-cherenkov-blue-800 hover:bg-muted dark:text-cherenkov-blue-pastel",
                          ].join(" ")}
                        >
                          {topic.name}
                        </Link>
                      ) : (
                        <span className="block px-2 py-1 text-sm text-muted-foreground">
                          {topic.name}
                          <span className="ml-1.5 text-xs italic">({labels.comingSoon})</span>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
