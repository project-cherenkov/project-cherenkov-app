"use client";

import type { ParamSpec } from "@/components/viz/composed-scene/element-templates";

// Drives the inspector's per-element form (SCENE-007) from a template's
// declared paramSchema (SCENE-004). Every branch maps to a bounded HTML
// input — never a freeform code/expression field (Decision A) — matching
// FR-2's "numbers, small selects, booleans" plus SCENE-004's added bounded
// "text" type for genuinely non-executable display captions.
export function ParamField({
  spec,
  value,
  onChange,
}: {
  spec: ParamSpec;
  value: number | string | boolean;
  onChange: (value: number | string | boolean) => void;
}) {
  const inputId = `param-${spec.key}`;

  if (spec.type === "boolean") {
    return (
      <label htmlFor={inputId} className="flex items-center gap-2 text-sm">
        <input
          id={inputId}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        {spec.label}
      </label>
    );
  }

  if (spec.type === "select") {
    return (
      <label htmlFor={inputId} className="flex flex-col gap-1 text-sm">
        <span className="label-code text-slate-600 dark:text-slate-300">{spec.label}</span>
        <select
          id={inputId}
          className="rounded-md border border-border bg-transparent px-2 py-1"
          value={typeof value === "string" ? value : String(spec.default)}
          onChange={(e) => onChange(e.target.value)}
        >
          {(spec.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (spec.type === "text") {
    return (
      <label htmlFor={inputId} className="flex flex-col gap-1 text-sm">
        <span className="label-code text-slate-600 dark:text-slate-300">{spec.label}</span>
        <input
          id={inputId}
          type="text"
          maxLength={spec.maxLength}
          className="rounded-md border border-border bg-transparent px-2 py-1"
          value={typeof value === "string" ? value : String(spec.default)}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    );
  }

  // "number"
  const numericValue = typeof value === "number" ? value : Number(spec.default);
  return (
    <label htmlFor={inputId} className="flex flex-col gap-1 text-sm">
      <span className="label-code text-slate-600 dark:text-slate-300">{spec.label}</span>
      <input
        id={inputId}
        type="number"
        min={spec.min}
        max={spec.max}
        step={spec.step ?? 1}
        className="rounded-md border border-border bg-transparent px-2 py-1"
        value={numericValue}
        onChange={(e) => {
          const next = e.target.valueAsNumber;
          if (Number.isFinite(next)) onChange(next);
        }}
      />
    </label>
  );
}
