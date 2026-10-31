"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { Editorial } from "#content";

import { isGraphArrayStepperConfig } from "./graph-array-stepper/types";
import { isTrajectorySandboxConfig } from "./trajectory-sandbox/types";
import { isOrbitalSandboxConfig } from "./orbital-sandbox/types";
import { isComposedSceneConfig } from "./composed-scene/types";
import { isProgrammableSceneConfig } from "./programmable-scene/types";

// Each engine is its own dynamic import (ssr: false — they're all
// canvas/SVG + browser APIs like ResizeObserver) so an editorial page only
// downloads the one engine it actually uses, never all three
// (spec §8: "code-split visualization... bundles per editorial page rather
// than loading them globally").
const GraphArrayStepper = dynamic(
  () => import("./graph-array-stepper").then((m) => m.GraphArrayStepper),
  { ssr: false, loading: () => <VizSkeleton /> },
);
const TrajectorySandbox = dynamic(
  () => import("./trajectory-sandbox").then((m) => m.TrajectorySandbox),
  { ssr: false, loading: () => <VizSkeleton /> },
);
const OrbitalSandbox = dynamic(
  () => import("./orbital-sandbox").then((m) => m.OrbitalSandbox),
  { ssr: false, loading: () => <VizSkeleton /> },
);
const ComposedScene = dynamic(
  () => import("./composed-scene").then((m) => m.ComposedScene),
  { ssr: false, loading: () => <VizSkeleton /> },
);
// PROG-006: this dynamic import is what keeps Blockly (a large,
// authoring-only dependency, pulled in transitively by
// components/site/scene-builder/block-editor.tsx) out of every reader-facing
// bundle — ProgrammableScene itself never imports block-editor.tsx, so a
// reader's editorial-page chunk for this engine never reaches it either.
const ProgrammableScene = dynamic(
  () => import("./programmable-scene").then((m) => m.ProgrammableScene),
  { ssr: false, loading: () => <VizSkeleton /> },
);

type VizEditorial = Pick<Editorial, "vizConfig">;

// One bordered card holds the sliders, the canvas and the playback controls,
// so the reader sees a single instrument rather than three loose pieces. The
// error and "missing" states are NOT framed: they are notices, not
// visualizations.
function VizFrame({ children }: { children: ReactNode }) {
  return (
    // flex + [&>*]:grow lets a frame be stretched by its parent (the home page's
    // carousel gives every slide the same height); in normal flow the frame is
    // content-sized and these do nothing.
    <div className="flex flex-col rounded-lg border border-border-strong/40 bg-card p-4 shadow-sm sm:p-5 [&>*]:grow">
      {children}
    </div>
  );
}

export function VizEngine({ editorial }: { editorial: VizEditorial }) {
  const { discriminant, value } = editorial.vizConfig;
  switch (discriminant) {
    case "graph-array-stepper":
      if (!isGraphArrayStepperConfig(value)) {
        return <VizConfigError engine={discriminant} />;
      }
      return (
        <VizFrame>
          <GraphArrayStepper config={value} />
        </VizFrame>
      );

    case "trajectory-sandbox":
      if (!isTrajectorySandboxConfig(value)) {
        return <VizConfigError engine={discriminant} />;
      }
      return (
        <VizFrame>
          <TrajectorySandbox config={value} />
        </VizFrame>
      );

    case "orbital-sandbox":
      if (!isOrbitalSandboxConfig(value)) {
        return <VizConfigError engine={discriminant} />;
      }
      return (
        <VizFrame>
          <OrbitalSandbox config={value} />
        </VizFrame>
      );

    case "composed-scene":
      if (!isComposedSceneConfig(value)) {
        return <VizConfigError engine={discriminant} />;
      }
      return (
        <VizFrame>
          <ComposedScene config={value} />
        </VizFrame>
      );

    case "programmable-scene":
      if (!isProgrammableSceneConfig(value)) {
        return <VizConfigError engine={discriminant} />;
      }
      return (
        <VizFrame>
          <ProgrammableScene config={value} />
        </VizFrame>
      );

    case "none":
    default:
      return <VizMissing />;
  }
}

function VizSkeleton() {
  const t = useTranslations("viz");
  // The engines are client-only (ssr: false), so this placeholder is all the
  // server renders — and all a screen reader finds until the chunk arrives.
  return (
    <div
      role="status"
      aria-busy="true"
      className="flex h-64 w-full animate-pulse items-center justify-center rounded-md border border-border bg-muted"
    >
      <span className="sr-only">{t("loading")}</span>
    </div>
  );
}

// spec §1 vs §6 conflict (see velite.config.ts) — an editorial with no
// usable visualization is treated as a flagged content error, not hidden.
function VizMissing() {
  const t = useTranslations("editorial");
  return (
    <div className="rounded-md border border-dashed border-cherenkov-pink-pastel bg-cherenkov-pink/20 p-4 text-sm text-foreground/80">
      {t("vizMissing")}
    </div>
  );
}

function VizConfigError({ engine }: { engine: string }) {
  const t = useTranslations("editorial");
  return (
    <div className="rounded-md border border-dashed border-red-300 bg-red-50 p-4 text-sm text-red-700">
      {t("vizConfigError", { engine })}
    </div>
  );
}
