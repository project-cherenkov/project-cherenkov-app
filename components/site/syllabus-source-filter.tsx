"use client";

import { useEffect, useState } from "react";

// Narrows the syllabus list to the topics of one source. It only toggles the
// `hidden` attribute on elements the server already rendered, so the page is
// complete and readable with no JavaScript, stays statically generated, and
// every topic keeps its anchor. Elements opt in with:
//   data-sources="osn ipho"      on a topic or section (space-separated ids)
//   data-count-for-section       on a section's topic counter
//   data-one / data-other        plural templates for that counter ("# topic")
export interface SourceFilterOption {
  id: string;
  label: string;
}

const ALL = "all";

export function SyllabusSourceFilter({
  targetId,
  options,
  label,
  allLabel,
  locale,
}: {
  targetId: string;
  options: SourceFilterOption[];
  label: string;
  allLabel: string;
  locale: string;
}) {
  const [selected, setSelected] = useState(ALL);

  useEffect(() => {
    const root = document.getElementById(targetId);
    if (!root) return;
    const matches = (element: Element) =>
      selected === ALL ||
      (element.getAttribute("data-sources") ?? "").split(" ").includes(selected);

    root.querySelectorAll<HTMLElement>("[data-topic][data-sources]").forEach((topic) => {
      topic.hidden = !matches(topic);
    });

    const plural = new Intl.PluralRules(locale);
    root.querySelectorAll<HTMLElement>("[data-section]").forEach((section) => {
      const visible = Array.from(section.querySelectorAll<HTMLElement>("[data-topic]")).filter(
        (topic) => !topic.hidden,
      ).length;
      const isPractical = section.getAttribute("data-practical") === "true";
      section.hidden = isPractical ? !matches(section) : visible === 0;
      const counter = section.querySelector<HTMLElement>("[data-count-for-section]");
      if (counter) {
        const template =
          (plural.select(visible) === "one" ? counter.dataset.one : counter.dataset.other) ??
          counter.dataset.other ??
          "";
        counter.textContent = template.replace("#", String(visible));
      }
    });
  }, [selected, targetId, locale]);

  const buttonClass = (active: boolean) =>
    `inline-flex min-h-11 items-center rounded-md border px-3 font-mono text-xs uppercase tracking-wide ${
      active
        ? "border-border-strong bg-muted text-foreground"
        : "border-border text-foreground hover:bg-muted"
    }`;

  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      <span className="label-code">{label}</span>
      {[{ id: ALL, label: allLabel }, ...options].map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={selected === option.id}
          onClick={() => setSelected(option.id)}
          className={buttonClass(selected === option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
