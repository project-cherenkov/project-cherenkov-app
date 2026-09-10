"use client";

import { useMemo, useState } from "react";
import { ComposedScene } from "@/components/viz/composed-scene";
import { isComposedSceneConfig } from "@/components/viz/composed-scene/types";
import { ProgrammableScene } from "@/components/viz/programmable-scene";
import { isProgrammableSceneConfig } from "@/components/viz/programmable-scene/types";
import type { ProgramNode } from "@/components/viz/programmable-scene/types";
import { isKnownSubject, SUBJECTS } from "@/lib/subjects";
import {
  addControl,
  addElement,
  addStep,
  clearStepOverrideElement,
  createEmptyDraft,
  isAtElementCap,
  isAtStepCap,
  moveStep,
  removeControl,
  removeElement,
  removeStep,
  setStepOverrideParam,
  toPublishableConfig,
  updateElementLabel,
  updateElementParam,
  updateStepNote,
  type SceneBuilderDraft,
} from "./draft-state";
import { SceneInspector } from "./inspector";
import { ScenePalette } from "./palette";
import { TimelineEditor } from "./timeline-editor";
import { BlockEditor } from "./block-editor";

type SaveStatus = "idle" | "saving" | "done" | "error";

// A programmable-scene program's own default canvas — matches
// content/editorials/informatics/programmable-scene-fixture.mdx's own
// canvas size (PROG-004), so a program built here previews at the same
// size it'll actually render at once copied into that kind of file.
const PROGRAMMABLE_SCENE_CANVAS = { widthPx: 320, heightPx: 200 };

// Shared by both engines' branches below — pulled out (PROG-004/005) so
// adding the second engine didn't mean duplicating this markup; the
// composed-scene branch's rendered output is unchanged by this extraction
// (same JSX, same classes, same text), which is what keeps
// scene-builder-app.test.tsx's existing assertions passing unmodified.
function TargetEditorialFields({
  subject,
  slug,
  onSubjectChange,
  onSlugChange,
}: {
  subject: string;
  slug: string;
  onSubjectChange: (value: string) => void;
  onSlugChange: (value: string) => void;
}) {
  return (
    <div className="rounded-md border border-dashed border-slate-300 p-3 text-sm dark:border-slate-700">
      <p className="label-code mb-2 text-slate-600 dark:text-slate-300">Target editorial</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500 dark:text-slate-400">Subject</span>
          <select
            className="rounded-md border border-border bg-transparent px-2 py-1"
            value={subject}
            onChange={(e) => onSubjectChange(e.target.value)}
          >
            <option value="" disabled>
              Choose a subject…
            </option>
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500 dark:text-slate-400">Slug</span>
          <input
            type="text"
            placeholder="binary-search-on-answer"
            className="rounded-md border border-border bg-transparent px-2 py-1"
            value={slug}
            onChange={(e) => onSlugChange(e.target.value)}
          />
        </label>
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Saving writes this scene into that editorial&apos;s <code className="font-mono">vizConfig</code>{" "}
        frontmatter — the editorial must already exist as a draft or published file.
      </p>
    </div>
  );
}

// PROG-005: the engine-select step this repository didn't yet have (see
// this feature's implementation report — the architect's spec assumed one
// already existed here, routing to palette/inspector/timeline; this file
// was actually hardcoded to composed-scene, so this toggle — and the
// conditional branch below it — is new, not a modification of an existing
// routing point).
function EngineSelect({
  engine,
  onChange,
}: {
  engine: "composed-scene" | "programmable-scene";
  onChange: (engine: "composed-scene" | "programmable-scene") => void;
}) {
  return (
    <div className="mb-4 flex items-center gap-4 text-sm">
      <span className="label-code text-slate-600 dark:text-slate-300">Engine</span>
      <label className="flex items-center gap-1.5">
        <input
          type="radio"
          name="scene-builder-engine"
          value="composed-scene"
          checked={engine === "composed-scene"}
          onChange={() => onChange("composed-scene")}
        />
        Composed scene
      </label>
      <label className="flex items-center gap-1.5">
        <input
          type="radio"
          name="scene-builder-engine"
          value="programmable-scene"
          checked={engine === "programmable-scene"}
          onChange={() => onChange("programmable-scene")}
        />
        Programmable scene
      </label>
    </div>
  );
}

// The scene builder is reached from a specific editorial's Keystatic entry
// (A-1: it "carries subject+slug as context"), so subject/slug arrive as
// query params when available; the inline fields below are the fallback
// for reaching the tool directly, and let an author retarget a scene
// they're iterating on without leaving the page.
export function SceneBuilderApp({
  initialSubject,
  initialSlug,
  initialEngine,
}: {
  initialSubject?: string;
  initialSlug?: string;
  initialEngine?: "composed-scene" | "programmable-scene";
}) {
  const [subject, setSubject] = useState(
    initialSubject && isKnownSubject(initialSubject) ? initialSubject : "",
  );
  const [slug, setSlug] = useState(initialSlug ?? "");
  const [engine, setEngine] = useState<"composed-scene" | "programmable-scene">(
    initialEngine ?? "composed-scene",
  );
  const [draft, setDraft] = useState<SceneBuilderDraft>(createEmptyDraft());
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null);
  const [program, setProgram] = useState<ProgramNode>({ kind: "sequence", body: [] });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const publishable = useMemo(() => toPublishableConfig(draft), [draft]);
  // Re-runs the exact same guard the write-back route and the reader page
  // use (NFR-1) — what's valid to save here is defined by one function,
  // not reimplemented as separate "can I save" UI logic.
  const isValidConfig = isComposedSceneConfig(publishable);
  const targetReady = isKnownSubject(subject) && slug.trim().length > 0;

  const programmableConfig = useMemo(
    () => ({ canvas: PROGRAMMABLE_SCENE_CANVAS, program }),
    [program],
  );
  const isProgramValid = isProgrammableSceneConfig(programmableConfig);

  function selectNewestElement(next: SceneBuilderDraft, previous: SceneBuilderDraft) {
    if (next === previous) return; // no-op add (cap reached / unknown template)
    const newest = next.elements[next.elements.length - 1];
    if (newest) setSelectedElementId(newest.id);
  }

  async function handleSave() {
    if (!targetReady || !isValidConfig) return;
    setSaveStatus("saving");
    setSaveError(null);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/scene-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, slug: slug.trim(), vizConfig: publishable }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveStatus("error");
        setSaveError(data.error ?? "Save failed.");
        return;
      }
      setSaveStatus("done");
      setSaveMessage(
        data.mode === "github"
          ? `Committed to a new branch: ${data.branch}. Open a pull request on GitHub to publish it.`
          : "Saved to the local content file.",
      );
    } catch {
      setSaveStatus("error");
      setSaveError("Save failed — network error.");
    }
  }

  if (engine === "programmable-scene") {
    return (
      <div>
        <EngineSelect engine={engine} onChange={setEngine} />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-4">
            <TargetEditorialFields
              subject={subject}
              slug={slug}
              onSubjectChange={setSubject}
              onSlugChange={setSlug}
            />

            <div className="rounded-md border border-border p-3">
              <p className="label-code mb-2 text-slate-600 dark:text-slate-300">Program</p>
              <BlockEditor controls={[]} onChange={setProgram} />
            </div>

            <div className="rounded-md border border-border p-3">
              <p className="label-code mb-2 text-slate-600 dark:text-slate-300">Preview</p>
              {isProgramValid ? (
                <ProgrammableScene config={programmableConfig} />
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  This program isn&apos;t valid yet — check for an unset variable or an unrecognized
                  element.
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-cherenkov-blue px-4 py-2 text-sm font-medium text-slate-900 opacity-50 transition-colors"
                disabled
                title="Programmable-scene publishing isn't wired up yet — see the compiled program below."
              >
                Save to editorial
              </button>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Publishing isn&apos;t wired up for this engine yet — copy the compiled program below
                into this editorial&apos;s <code className="font-mono">vizConfig</code> frontmatter by
                hand.
              </p>
            </div>

            {isProgramValid && (
              <details className="rounded-md border border-border p-3 text-xs">
                <summary className="label-code cursor-pointer text-slate-600 dark:text-slate-300">
                  Compiled program (copy into vizConfig.program)
                </summary>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono">
                  {JSON.stringify(program, null, 2)}
                </pre>
              </details>
            )}
          </div>
          <aside className="text-sm text-slate-500 dark:text-slate-400">
            <p>
              Drag blocks from the toolbox at left of the workspace above. Reader-facing controls
              aren&apos;t authorable here yet — add a <code className="font-mono">controls</code> array
              to the frontmatter by hand if a program needs one.
            </p>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div>
      <EngineSelect engine={engine} onChange={setEngine} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr_320px]">
        <aside className="flex flex-col gap-6">
          <ScenePalette
            onAdd={(templateId) =>
              setDraft((d) => {
                const next = addElement(d, templateId);
                selectNewestElement(next, d);
                return next;
              })
            }
            disabled={isAtElementCap(draft)}
          />
        </aside>

        <div className="flex flex-col gap-4">
          <TargetEditorialFields
            subject={subject}
            slug={slug}
            onSubjectChange={setSubject}
            onSlugChange={setSlug}
          />

          <div className="rounded-md border border-border p-3">
            <p className="label-code mb-2 text-slate-600 dark:text-slate-300">Preview</p>
            {isValidConfig ? (
              <ComposedScene config={publishable} />
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Add at least one element to see a preview.
              </p>
            )}
          </div>

          <TimelineEditor
            steps={draft.steps}
            selectedStepIndex={selectedStepIndex}
            onSelectStep={setSelectedStepIndex}
            onAddStep={() =>
              setDraft((d) => {
                const next = addStep(d);
                if (next !== d) setSelectedStepIndex(next.steps.length - 1);
                return next;
              })
            }
            onRemoveStep={(index) => {
              setDraft((d) => removeStep(d, index));
              setSelectedStepIndex((current) => {
                if (current === null) return null;
                if (current === index) return null;
                return current > index ? current - 1 : current;
              });
            }}
            onMoveStep={(index, direction) => setDraft((d) => moveStep(d, index, direction))}
            onUpdateNote={(index, note) => setDraft((d) => updateStepNote(d, index, note))}
            disabledAdd={isAtStepCap(draft)}
          />

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-cherenkov-blue px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-cherenkov-blue-pastel focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
              disabled={!targetReady || !isValidConfig || saveStatus === "saving"}
              onClick={() => void handleSave()}
            >
              {saveStatus === "saving" ? "Saving…" : "Save to editorial"}
            </button>
            {!targetReady && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose a subject and slug above to enable saving.
              </p>
            )}
            {targetReady && !isValidConfig && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Add at least one element to enable saving.
              </p>
            )}
          </div>
          {saveStatus === "error" && saveError && <p className="text-sm text-red-700">{saveError}</p>}
          {saveStatus === "done" && saveMessage && (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">{saveMessage}</p>
          )}
        </div>

        <aside>
          <SceneInspector
            draft={draft}
            selectedElementId={selectedElementId}
            onSelectElement={setSelectedElementId}
            onRemoveElement={(elementId) => {
              setDraft((d) => removeElement(d, elementId));
              setSelectedElementId((current) => (current === elementId ? null : current));
            }}
            onUpdateLabel={(elementId, label) => setDraft((d) => updateElementLabel(d, elementId, label))}
            stepIndex={selectedStepIndex}
            onUpdateBaseParam={(elementId, key, value) =>
              setDraft((d) => updateElementParam(d, elementId, key, value))
            }
            onUpdateStepOverride={(stepIndex, elementId, key, value) =>
              setDraft((d) => setStepOverrideParam(d, stepIndex, elementId, key, value))
            }
            onClearStepOverrideElement={(stepIndex, elementId) =>
              setDraft((d) => clearStepOverrideElement(d, stepIndex, elementId))
            }
            onAddControl={(elementId, paramKey, label) =>
              setDraft((d) => addControl(d, elementId, paramKey, label))
            }
            onRemoveControl={(controlId) => setDraft((d) => removeControl(d, controlId))}
          />
        </aside>
      </div>
    </div>
  );
}
