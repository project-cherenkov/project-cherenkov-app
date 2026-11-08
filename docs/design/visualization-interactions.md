# Project Cherenkov visualizations: what to learn from Brilliant, and what to change

> Moved from docs/viz-interaction-improvements.md on 2026-11-08.

Audience: contributors (human or AI agent) who will improve the viz engines in `components/viz/`.
Written 7 November 2026 from a read of the repo snapshot `project-cherenkov-app-main` (zip dated 3 Nov 2026) and public information about Brilliant.org.
How to read this: Section 0 is the whole story. Section 1 is what Brilliant does. Section 2 is what Cherenkov does today. Section 3 is the gap. Section 4 is the recommendations, in priority order, each with acceptance criteria. Section 5 lists what not to do. Section 6 lists open questions. Section 7 lists sources and how far to trust each.

Labels used throughout (same convention as `docs/product/planner-context-transfer.md`):
- [USER-DECIDED]: the project owner said this explicitly. Do not change without asking.
- [OBSERVED]: read directly in the repo or on a public page during this review.
- [RESEARCHED]: taken from a published source listed in Section 7.
- [PROPOSED]: a suggestion made in this document. Not validated with users. Treat as a starting point.
- [UNVERIFIED]: believed likely but not confirmed. Do not build on it without checking.

---

## 0. One-page summary

[USER-DECIDED] Goal: learn from Brilliant's visualizations to improve Cherenkov's.

The key finding: Cherenkov's engine architecture is already close to what Brilliant describes. Both use declarative, validated configs so that no configuration can produce a broken scene. The gap is not the engine. It is how the reader interacts with it.

Three differences matter most:
1. Readers manipulate scenes only through sliders and play/step/scrub controls. There is no direct manipulation (dragging the thing itself). [OBSERVED]
2. Scenes explain but never ask. There is no predict, act, check loop. [OBSERVED]
3. Composed-scene steps snap from one state to the next instead of animating. [OBSERVED]

Recommended order of work [PROPOSED]:

| # | Change | Size | Schema change? |
|---|---|---|---|
| R1 | Tween between steps in `composed-scene` | Small | No |
| R2 | Draggable launch handle in `trajectory-sandbox` | Medium | No |
| R3 | Optional `challenge` field (predict, act, check) | Medium | Yes, additive and optional |
| R4 | Cleanups: text alternatives, shared helpers | Small | No |

Do not copy Brilliant's technology stack. Section 5 explains why.

---

## 1. What Brilliant does

### 1.1 Confirmed from primary sources [RESEARCHED]

- Brilliant's interactives are driven by game-specific APIs designed for both human experts and LLMs, where every possible configuration is guaranteed to be correct, solvable and meaningful. (Brilliant job posting, Section 7.)
- Authors design the game, the progression and the "aha moment". AI only handles technical implementation, and every generated problem goes through human review for design and correctness. (Brilliant blog, Section 7.)
- Their stated philosophy is that understanding should come from doing, not reading, with the Super Mario "fall into the pit and learn" loop as the model. (Brilliant blog.)
- Per the interactives engineer job posting, the role works with Elm, JavaScript, TypeScript, HTML, CSS and SVG. Elm is described as helpful experience rather than a hard requirement.
- Rive's own case study says Brilliant uses Rive for day streaks and color-coded learning paths, including path nodes and connecting lines.

### 1.2 Observed on the public site [OBSERVED]

A scrape of the public course page `brilliant.org/courses/pre-algebra/` showed:
- A Next.js app (`/_next/static/` chunks).
- A Rive WebAssembly runtime and a `.riv` file named `koji-gameboard` preloaded.
- Panda CSS atomic class names.
- Heavy inline SVG.
- A `data-reduced-motion` attribute on `<html>`.

### 1.3 Not verified [UNVERIFIED]

Lesson pages are behind a login. The actual interactive runtime was not inspected. That Brilliant's lesson interactives are Elm-driven SVG is inferred from the job posting, not seen in shipped code. To check it, open a lesson with a free account and look at the Network and Elements panels in DevTools.

---

## 2. What Cherenkov does today [OBSERVED]

### 2.1 Architecture

`components/viz/viz-engine.tsx` dispatches on `vizConfig.discriminant` to one of five engines. Each is loaded with `next/dynamic` and `ssr: false`, so an editorial page only downloads the engine it uses. Each engine has a type guard that rejects an invalid config before render (`isGraphArrayStepperConfig`, `isTrajectorySandboxConfig`, `isOrbitalSandboxConfig`, `isComposedSceneConfig`, `isProgrammableSceneConfig`). The `vizConfig.value` field in `velite.config.ts` is `s.record(s.string(), s.unknown())`, so the schema itself is open and validation happens in the guards.

| Engine | Renders with | Interaction today |
|---|---|---|
| `graph-array-stepper` | SVG | Playback controls |
| `trajectory-sandbox` | Canvas 2D | Two sliders (speed, angle) + playback |
| `orbital-sandbox` | Canvas 2D for the orbit, SVG for the light curve | Sliders + playback (rAF loop) |
| `composed-scene` | Canvas 2D via a template registry | Sliders/toggles bound to params, timeline steps + playback |
| `programmable-scene` | Same canvas renderer, driven by a bounded Blockly-authored interpreter | Controls read by the program |

### 2.2 Strengths worth keeping

- Closed template registry (`composed-scene/element-templates.ts`): every param is a bounded number, boolean, select or short text. No freeform expressions.
- Hard caps: `MAX_ELEMENTS = 12`, `MAX_STEPS = 20`, `MAX_REPEAT = 64`, `OPERATION_BUDGET = 5000`.
- `resolveElementParams` in `render-elements.ts` is a pure function with clear precedence: base params, then step overrides, then live control values. Base params are never mutated.
- `PlaybackControls` is shared across engines so the control surface feels consistent.
- Numeric readouts next to the canvas (range, max height) and a legend that stays in the layout to avoid height jumps at 45°.
- A scene builder (Keystatic + Blockly) reuses `ComposedScene` unmodified as its live preview.

This is the same property Brilliant calls out in Section 1.1. Do not weaken the guards while making the changes below.

---

## 3. Gap analysis

| Brilliant behavior | Cherenkov today | Evidence |
|---|---|---|
| Learner acts on the object itself (drag, place, connect) [RESEARCHED: "learn by doing"] | Sliders and playback only. `grep` finds no pointer handlers in `components/viz`; the only "drag" matches are comments. | `trajectory-sandbox/index.tsx`, `composed-scene/index.tsx` |
| Problem first: the learner is asked something and gets feedback [RESEARCHED] | Steps carry a `note` (markdown + KaTeX) but never a question or a check. | `composed-scene/types.ts` (`SceneStep`) |
| Motion communicates change (Rive for UI, SVG/CSS for interactives) [RESEARCHED/OBSERVED] | Step changes snap. Autoplay is a `setTimeout` per step (`STEP_INTERVAL_MS = 900`). | `composed-scene/index.tsx` |
| Interactives are DOM/SVG, so hit-testing, focus and pointer events come free [RESEARCHED] | Mixed: `graph-array-stepper` is SVG, the orbit and the trajectory/composed scenes are Canvas 2D. On canvas, hit-testing and focus would be hand-rolled. | `graph-array-stepper/index.tsx`, `setupCanvasForDpr`, each engine's draw effect |

Honest caveat: this review judged code and config, not the visual output. It did not run the app, so look and feel (spacing, color, pacing) is not assessed here.

---

## 4. Recommendations

Implementation rule for all items: deliver changes as unified diffs against the repo, keep `pnpm test` (vitest) green, and add strings to both locales (`messages/`; `messages-parity.test.ts` enforces parity).

### R1. Tween between steps in `composed-scene` [PROPOSED]

Goal: when the reader moves from step N to step N+1, numeric params glide to their new values instead of snapping.

Why first: no schema change, no new UI, and it works with the existing bounded numeric params.

Approach:
- Add a pure function next to `resolveElementParams` in `composed-scene/render-elements.ts`, for example `interpolateStepOverrides(elements, fromStep, toStep, t)`.
- For each element, compute `from = {...base, ...fromStep.overrides[id]}` and `to = {...base, ...toStep.overrides[id]}`. For each key in the union of both steps' override keys:
  - Numbers: linear interpolation, with an ease-in-out curve applied to `t`.
  - Booleans, strings, selects: switch at `t >= 0.5`.
- Return a synthetic `SceneStep` containing the interpolated overrides, and pass it to `renderElements` as `currentStep`. Control values keep their existing higher precedence.
- In `ComposedScene`, add a short progress animation (about 400 ms, shorter than `STEP_INTERVAL_MS`) driven by `requestAnimationFrame` whenever `stepIndex` changes by exactly 1.
- Snap with no animation when: the reader scrubs or jumps more than one step, the config changes, or `prefers-reduced-motion: reduce` matches.

Acceptance criteria:
- At `t = 0` the output equals the previous step's resolved params. At `t = 1` it equals the next step's.
- Interpolated numbers always stay inside the template's declared `min`/`max` (guaranteed because both endpoints are valid and interpolation is convex; add a test anyway).
- Base params are never mutated (preserves the existing SCENE-005 criterion).
- Autoplay still advances on its timer and does not skip steps.
- `programmable-scene` is unaffected.
- Unit tests for the pure function: numeric lerp, boolean/string switch, element present in only one step's overrides, missing keys falling back to base.

Risks: the 400 ms animation overlapping the 900 ms autoplay tick is fine; overlapping manual clicks need the animation to restart from the current displayed state, not from the previous step. Decide this explicitly in the implementation.

### R2. Draggable launch handle in `trajectory-sandbox` [PROPOSED]

Goal: let the reader aim by dragging, with the slider kept as the accessible fallback.

Design constraints found in the code:
- The drawing scale in `trajectory-sandbox/index.tsx` refits whenever range or peak changes (`scale = Math.min(plotW / maxRange, plotH / maxPeak)`). A handle placed at the arc's end would therefore jitter under the pointer while dragging.
- Fix: place the handle at a fixed radius (for example 48 px) from the launch origin, along the launch direction. The origin is `(PADDING_PX, CANVAS_HEIGHT - PADDING_PX)` in CSS pixels and does not depend on the scale. The angle is `atan2` of the pointer relative to that origin.
- Do not put pointer handling on the whole canvas. On phones, `touch-action: none` over a full-width canvas would trap page scrolling. Use a small DOM element (a `<div role="slider">`) absolutely positioned over the canvas, with `touch-action: none` on the handle only.

Approach:
- Hoist the origin and handle-position math out of the draw effect so the draw code and the handle share it.
- Handle: `onPointerDown` calls `setPointerCapture`; `onPointerMove` computes the angle and clamps it to `config.angleRange ?? [5, 85]`; release on `onPointerUp`.
- Keyboard: `role="slider"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-label` using the existing `trajectoryLabel` message style. Arrow keys move 1°, Shift+arrow 5°.
- Angle only for now. Speed stays on its slider.
- Reuse the existing effect that resets `simTime` and stops playback when the angle changes.

Acceptance criteria:
- Dragging the handle and moving the angle slider stay in sync in both directions.
- The handle never leaves the allowed angle range and does not move when the scale refits.
- Page scrolling still works when the touch starts outside the handle.
- Handle is reachable and operable by keyboard alone.
- Existing trajectory tests pass.

### R3. Optional `challenge` field: predict, act, check [PROPOSED]

Goal: turn a sandbox into a problem. Start with `trajectory-sandbox` only.

Shape (additive and optional):

    challenge?: {
      prompt: string;           // markdown + KaTeX, rendered with MarkdownText
      target: { rangeM: number; toleranceM: number };
      hint?: string;
      successNote?: string;
    }

Behavior:
- The target appears on the ground line. The reader sets angle/speed and launches with the existing Play button.
- When the flight ends, the engine checks `|landingX - target.rangeM| <= toleranceM` and shows success or "try again".
- After two failed attempts (counted in local component state only), show the hint.
- The drawing scale must include the target so it is never clipped.

Guard rules (this carries over Brilliant's "guaranteed solvable" principle):
- `toleranceM > 0` and `rangeM > 0`, both finite.
- The challenge must be solvable within `speedRange` and `angleRange`: using range = v² · sin(2θ) / g, some allowed (speed, angle) pair must land within tolerance. Reject the config otherwise, so a published editorial can never contain an impossible challenge.

Acceptance criteria: guard tests for valid, unsolvable, and malformed challenges; a component test for success, failure and hint; both locales updated; `vizConfig.value` stays `s.record(s.string(), s.unknown())` so no velite schema change is needed.

Constraint to resolve first: a comment in `components/viz/shared/canvas-dpr.ts` cites a requirement "CR-3" saying the existing engines' config shapes and type guards must not change. R3 adds an optional field and extends the trajectory guard. Confirm with the owner whether CR-3 still applies or was scoped to the composed-scene work only (see Section 6).

### R4. Small cleanups [PROPOSED]

- `composed-scene` gives its canvas a fixed `aria-label` (`canvasLabel`), while `trajectory-sandbox` includes live values in its label. For composed scenes, expose the current step note to assistive tech, for example with `aria-describedby` pointing at the note element.
- `setupCanvasForDpr` is used only by `composed-scene` and `programmable-scene`. The trajectory and orbital engines inline the same logic. Retrofit only after the CR-3 question is settled.
- The rAF loops call `setState` every frame. This is fine at the current scale. Do not optimize without a measured problem.

---

## 5. What not to do

- Do not adopt Elm, or write a custom game engine to mirror Brilliant. The valuable property (validated, bounded configs) already exists here. A five-person Next.js project gains little from a second language.
- Do not rewrite the engines from canvas to SVG. `ElementTemplate.render` takes a `CanvasRenderingContext2D`, so SVG would mean a second render path for every template. If a scene needs draggable objects, use the DOM-overlay-handle pattern from R2 instead. Revisit SVG only if many draggable objects are needed in one scene.
- Do not add Rive now. It could suit progress or streak animations later, but nothing in the viz engines needs it.
- Do not loosen guards or raise caps (`MAX_ELEMENTS`, `MAX_STEPS`, `OPERATION_BUDGET`) to make a new feature easier.
- Do not use an LLM to explain concepts to readers. Brilliant's own blog says they stayed away from tutoring chatbots and use AI to build games under human review. Their approach is a reference, not a requirement.

---

## 6. Open questions for the project owner

1. Does "CR-3" (existing engine config shapes and guards stay unchanged) still apply, or was it scoped to the composed-scene work? This blocks R3 and the DPR retrofit in R4.
2. Should challenges (R3) be limited to `trajectory-sandbox` first, or also added to `composed-scene`, where a target-and-tolerance check would need a template for the target?
3. Is attempt tracking local-only (as proposed), or should it feed the planner/progress system later? This document assumes local-only.
4. Should the Keystatic/scene-builder UI expose `challenge` authoring, or is frontmatter editing enough for now? The Keystatic config was not reviewed here.

---

## 7. Sources and how far to trust them

| Source | Used for | Trust |
|---|---|---|
| Brilliant job posting, "Software Engineer (Interactives)", `jobs.lever.co/brilliant/2e86ce40-3c7e-4924-b3cb-bfe74b492353` | APIs guaranteeing solvable configs; Elm/JS/TS/HTML/CSS/SVG | High for what Brilliant says it hires for; says nothing about what ships in every lesson |
| Brilliant blog, "Hand-crafted, machine-made: How we make learning games with AI", `blog.brilliant.org/hand-crafted-machine-made/` | Game engine, authors in control, human review, learning philosophy | High (first party); marketing-flavored |
| Rive blog, "How Brilliant.org motivates learners with animations" (May 2024), `rive.app/blog/how-brilliant-org-motivates-learners-with-rive-animations` | Rive used for streaks and paths | Medium (vendor case study) |
| Scrape of `brilliant.org/courses/pre-algebra/` | Next.js, Rive runtime, Panda CSS, SVG, reduced-motion attribute | High for the public page only; lessons not inspected |
| Cherenkov repo snapshot `project-cherenkov-app-main` | All [OBSERVED] statements about Cherenkov | High for the files read: `viz-engine.tsx`, `composed-scene/*`, `trajectory-sandbox/*`, `programmable-scene/interpreter.ts` (header), `orbital-sandbox/physics-functions.ts` (head), `playback-controls.tsx`, `velite.config.ts` (viz fields). Other files were not reviewed. |

---

## 8. Implementation status (added 7 November 2026)

[USER-DECIDED] The project owner asked for R1 to R4 to be implemented together, which also settles open question 1: CR-3 no longer blocks changes to the trajectory-sandbox guard or the DPR retrofit.

| Item | Status | Where |
|---|---|---|
| R1 tween between steps | Done | `composed-scene/render-elements.ts` (`interpolateStepOverrides`, `easeInOut`), `composed-scene/index.tsx` (`goToStep`, glide loop) |
| R2 draggable launch handle | Done | `trajectory-sandbox/launch-handle.ts` (geometry), `trajectory-sandbox/index.tsx` (handle element) |
| R3 `challenge` field | Done | `trajectory-sandbox/types.ts` (type, guard, solvability check), `trajectory-sandbox/index.tsx` (target, verdict, hint) |
| R4 text alternative for composed scenes | Done | `composed-scene/index.tsx` (`aria-describedby` on the canvas) |
| R4 DPR helper retrofit | Done | `trajectory-sandbox/index.tsx`, `orbital-sandbox/index.tsx` now call `setupCanvasForDpr`; comment in `shared/canvas-dpr.ts` updated |

Decisions the document left open, and what was chosen [PROPOSED, not validated with users]:

- Interrupted glides (R1): a click during a glide restarts from the state on screen. Reset, a new config, a scrub, a move of more than one step and `prefers-reduced-motion` all snap.
- Scrubber (R1): dragging the scrubber snaps, because it fires one change per notch and should follow the pointer. Only the step buttons and autoplay glide.
- Solvability (R3): checked on the slider grid (whole 1 m/s and 1° steps starting from each range's minimum), not on the continuous range, because the sliders and the handle snap to those steps. A speed range wider than 5000 steps is rejected rather than searched.
- What counts as an attempt (R3): a flight that runs to its end after Play was pressed from t = 0. Scrubbing or stepping to the end does not count, and neither does pressing Play when the marker is already parked at the landing. Reset then Play counts again.
- Verdict (R3): shows how far short or long the landing was. The verdict clears when speed or angle changes. The hint stays visible after it appears until the reader hits the target.
- Handle (R2): angle only, snapped to the slider's grid, Home/End jump to the bounds in addition to the arrow keys the proposal listed.
- Open question 2 (challenges in `composed-scene`): not done; trajectory-sandbox only.
- Open question 3 (attempt tracking): local component state only, as proposed.
- Open question 4 (Keystatic): not done. Keystatic's reader rejects an editorial whose `vizConfig.value` contains `challenge` ("Invalid data"), the same class of limit as the programmable-scene fixture, so a challenge is authored in the file. Supporting it in the form needs an optional conditional field plus a normalisation step, and is a separate change.

Observation for a later pass: in a challenge the dashed full-flight preview and the "range ≈" readout both show where the launch will land, so a reader can line the arc up with the target without predicting anything. A `blindAim` option that hides them until the first launch would restore the predict step.
