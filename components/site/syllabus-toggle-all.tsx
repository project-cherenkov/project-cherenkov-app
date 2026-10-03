"use client";

// Expand / collapse every syllabus section at once. The sections themselves
// are native <details> elements (searchable with Find-in-page, deep-linkable,
// keyboard-operable with zero JS) — this only flips their `open` attribute, so
// the page is fully usable if this component never hydrates.
export function SyllabusToggleAll({
  targetId,
  expandLabel,
  collapseLabel,
}: {
  targetId: string;
  expandLabel: string;
  collapseLabel: string;
}) {
  function setAll(open: boolean) {
    document
      .getElementById(targetId)
      ?.querySelectorAll("details")
      .forEach((details) => {
        details.open = open;
      });
  }

  const buttonClass =
    "inline-flex min-h-11 items-center rounded-md border border-border px-3 font-mono text-xs uppercase tracking-wide text-foreground hover:bg-slate-100 dark:hover:bg-slate-800";

  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => setAll(true)} className={buttonClass}>
        {expandLabel}
      </button>
      <button type="button" onClick={() => setAll(false)} className={buttonClass}>
        {collapseLabel}
      </button>
    </div>
  );
}
