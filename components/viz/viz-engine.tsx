"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { Editorial } from "#content";

import { isGraphArrayStepperConfig } from "./graph-array-stepper/types";
import { isTrajectorySandboxConfig } from "./trajectory-sandbox/types";
import { isOrbitalSandboxConfig } from "./orbital-sandbox/types";

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

type VizEditorial = Pick<Editorial, "vizEngine" | "vizConfig">;

export function VizEngine({ editorial }: { editorial: VizEditorial }) {
  switch (editorial.vizEngine) {
    case "graph-array-stepper":
      if (!isGraphArrayStepperConfig(editorial.vizConfig)) {
        return <VizConfigError engine={editorial.vizEngine} />;
      }
      return <GraphArrayStepper config={editorial.vizConfig} />;

    case "trajectory-sandbox":
      if (!isTrajectorySandboxConfig(editorial.vizConfig)) {
        return <VizConfigError engine={editorial.vizEngine} />;
      }
      return <TrajectorySandbox config={editorial.vizConfig} />;

    case "orbital-sandbox":
      if (!isOrbitalSandboxConfig(editorial.vizConfig)) {
        return <VizConfigError engine={editorial.vizEngine} />;
      }
      return <OrbitalSandbox config={editorial.vizConfig} />;

    case "none":
    default:
      return <VizMissing />;
  }
}

function VizSkeleton() {
  return (
    <div className="h-64 w-full animate-pulse rounded-md border border-slate-200 bg-slate-100" />
  );
}

// spec §1 vs §6 conflict (see velite.config.ts) — an editorial with no
// usable visualization is treated as a flagged content error, not hidden.
function VizMissing() {
  const t = useTranslations("editorial");
  return (
    <div className="rounded-md border border-dashed border-cherenkov-pink-pastel bg-cherenkov-pink/20 p-4 text-sm text-slate-700">
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
