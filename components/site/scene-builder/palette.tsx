"use client";

import { ELEMENT_TEMPLATE_KEYS, ELEMENT_TEMPLATES } from "@/components/viz/composed-scene/element-templates";
import { Button } from "@/components/ui/button";

// One card per registry entry (11 today) — the handoff report's own design
// note calls for this explicitly ("SCENE-007's palette should render one
// card per registry entry"), rather than grouping by shape/curve/etc.
// Drag-and-drop onto the canvas is out of scope for this pass (spec §10
// "Recommended" list) — click-to-add is the acceptance criterion.
export function ScenePalette({
  onAdd,
  disabled,
}: {
  onAdd: (templateId: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="label-code text-slate-600 dark:text-slate-300">Add an element</h2>
      <div className="grid grid-cols-2 gap-2">
        {ELEMENT_TEMPLATE_KEYS.map((id) => {
          const template = ELEMENT_TEMPLATES[id];
          if (!template) return null;
          return (
            <Button
              key={id}
              type="button"
              variant="outline"
              size="sm"
              className="h-auto justify-start whitespace-normal py-2 text-left"
              disabled={disabled}
              onClick={() => onAdd(id)}
            >
              {template.label}
            </Button>
          );
        })}
      </div>
      {disabled && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          This scene has reached the maximum number of elements.
        </p>
      )}
    </div>
  );
}
