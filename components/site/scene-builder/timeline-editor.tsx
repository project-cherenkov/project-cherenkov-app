"use client";

import { Button } from "@/components/ui/button";
import type { SceneStep } from "@/components/viz/composed-scene/types";

interface TimelineEditorProps {
  steps: SceneStep[];
  /** null = editing base params (no step selected / static scene). */
  selectedStepIndex: number | null;
  onSelectStep: (index: number | null) => void;
  onAddStep: () => void;
  onRemoveStep: (index: number) => void;
  onMoveStep: (index: number, direction: -1 | 1) => void;
  onUpdateNote: (index: number, note: string) => void;
  disabledAdd: boolean;
}

// A composed scene's timeline is optional (spec §6: "a scene with elements
// but no steps is valid and renders as a static scene") — this pane is
// always shown, but an empty step list is a perfectly normal, valid state,
// not an error.
export function TimelineEditor({
  steps,
  selectedStepIndex,
  onSelectStep,
  onAddStep,
  onRemoveStep,
  onMoveStep,
  onUpdateNote,
  disabledAdd,
}: TimelineEditorProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="label-code text-slate-600 dark:text-slate-300">Timeline steps</h2>
        <Button type="button" variant="outline" size="sm" disabled={disabledAdd} onClick={onAddStep}>
          + Add step
        </Button>
      </div>

      <button
        type="button"
        className={`rounded-md border px-2 py-1 text-left text-sm ${
          selectedStepIndex === null
            ? "border-cherenkov-blue-pastel bg-cherenkov-blue/20"
            : "border-border hover:bg-slate-100 dark:hover:bg-slate-800"
        }`}
        onClick={() => onSelectStep(null)}
      >
        Base parameters {steps.length === 0 ? "(static scene)" : "(before any step overrides)"}
      </button>

      {steps.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No timeline steps yet — this will render as a static scene. Add a step to make it
          scrubbable.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {steps.map((step, index) => (
            <li
              key={index}
              className={`flex flex-col gap-1 rounded-md border p-2 ${
                selectedStepIndex === index
                  ? "border-cherenkov-blue-pastel bg-cherenkov-blue/10"
                  : "border-border"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  className="text-left text-sm font-medium"
                  onClick={() => onSelectStep(index)}
                >
                  Step {index + 1}
                </button>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Move step ${index + 1} up`}
                    disabled={index === 0}
                    onClick={() => onMoveStep(index, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Move step ${index + 1} down`}
                    disabled={index === steps.length - 1}
                    onClick={() => onMoveStep(index, 1)}
                  >
                    ↓
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove step ${index + 1}`}
                    onClick={() => onRemoveStep(index)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
              <textarea
                className="rounded-md border border-border bg-transparent px-2 py-1 text-sm"
                placeholder="Step note — Markdown and $KaTeX$ supported"
                value={step.note ?? ""}
                onChange={(e) => onUpdateNote(index, e.target.value)}
                rows={2}
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
