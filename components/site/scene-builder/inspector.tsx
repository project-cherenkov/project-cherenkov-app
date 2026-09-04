"use client";

import { ELEMENT_TEMPLATES } from "@/components/viz/composed-scene/element-templates";
import { Button } from "@/components/ui/button";
import type { SceneBuilderDraft } from "./draft-state";
import { ParamField } from "./param-field";

interface InspectorProps {
  draft: SceneBuilderDraft;
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onRemoveElement: (elementId: string) => void;
  onUpdateLabel: (elementId: string, label: string) => void;
  /** Editing mode: base params (stepIndex === null) or one step's overrides. */
  stepIndex: number | null;
  onUpdateBaseParam: (elementId: string, key: string, value: number | string | boolean) => void;
  onUpdateStepOverride: (
    stepIndex: number,
    elementId: string,
    key: string,
    value: number | string | boolean,
  ) => void;
  onClearStepOverrideElement: (stepIndex: number, elementId: string) => void;
  onAddControl: (elementId: string, paramKey: string, label: string) => void;
  onRemoveControl: (controlId: string) => void;
}

export function SceneInspector({
  draft,
  selectedElementId,
  onSelectElement,
  onRemoveElement,
  onUpdateLabel,
  stepIndex,
  onUpdateBaseParam,
  onUpdateStepOverride,
  onClearStepOverrideElement,
  onAddControl,
  onRemoveControl,
}: InspectorProps) {
  const selected = draft.elements.find((el) => el.id === selectedElementId) ?? null;
  const template = selected ? ELEMENT_TEMPLATES[selected.templateId] : undefined;
  const step = stepIndex !== null ? draft.steps[stepIndex] : undefined;
  const isOverridingSelected = Boolean(
    selected && step && selected.id in step.overrides,
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="label-code text-slate-600 dark:text-slate-300">Elements</h2>
        {draft.elements.length === 0 ? (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Add an element from the palette to get started.
          </p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1">
            {draft.elements.map((el) => {
              const elTemplate = ELEMENT_TEMPLATES[el.templateId];
              return (
                <li key={el.id} className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className={`flex-1 rounded-md px-2 py-1 text-left text-sm ${
                      el.id === selectedElementId
                        ? "bg-cherenkov-blue/30"
                        : "hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                    onClick={() => onSelectElement(el.id)}
                  >
                    {el.label || elTemplate?.label || el.templateId}
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${el.label || elTemplate?.label || el.templateId}`}
                    onClick={() => onRemoveElement(el.id)}
                  >
                    Remove
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {selected && template && (
        <div className="flex flex-col gap-3 rounded-md border border-border p-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="label-code text-slate-600 dark:text-slate-300">Name (optional)</span>
            <input
              type="text"
              className="rounded-md border border-border bg-transparent px-2 py-1"
              value={selected.label ?? ""}
              onChange={(e) => onUpdateLabel(selected.id, e.target.value)}
            />
          </label>

          {stepIndex === null || !step ? (
            <>
              <p className="label-code text-slate-500 dark:text-slate-400">Base parameters</p>
              {template.paramSchema.map((spec) => (
                <ParamField
                  key={spec.key}
                  spec={spec}
                  value={selected.params[spec.key] ?? spec.default}
                  onChange={(value) => onUpdateBaseParam(selected.id, spec.key, value)}
                />
              ))}
              {(() => {
                const bindable = template.paramSchema.filter(
                  (spec) => spec.type === "number" || spec.type === "boolean",
                );
                if (bindable.length === 0) return null;
                return (
                  <div className="flex flex-col gap-1 border-t border-border pt-2">
                    <span className="label-code text-slate-500 dark:text-slate-400">
                      Bind a reader control
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {bindable.map((spec) => (
                        <Button
                          key={spec.key}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onAddControl(selected.id, spec.key, spec.label)}
                        >
                          + {spec.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="label-code text-slate-500 dark:text-slate-400">
                  Overrides for this step
                </p>
                {isOverridingSelected && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onClearStepOverrideElement(stepIndex, selected.id)}
                  >
                    Revert to base
                  </Button>
                )}
              </div>
              {template.paramSchema.map((spec) => {
                const override = step.overrides[selected.id]?.[spec.key];
                const value = override ?? selected.params[spec.key] ?? spec.default;
                return (
                  <ParamField
                    key={spec.key}
                    spec={spec}
                    value={value}
                    onChange={(next) => onUpdateStepOverride(stepIndex, selected.id, spec.key, next)}
                  />
                );
              })}
            </>
          )}
        </div>
      )}

      {draft.controls.length > 0 && (
        <div>
          <h2 className="label-code text-slate-600 dark:text-slate-300">Reader controls</h2>
          <ul className="mt-1 flex flex-col gap-1">
            {draft.controls.map((control) => (
              <li key={control.id} className="flex items-center justify-between gap-2 text-sm">
                <span>{control.label}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveControl(control.id)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
