"use client";

import { useMemo, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { Material } from "#content";

import { usesMarker } from "@/components/mdx-marker";
import { useMDXComponent } from "@/components/use-mdx-component";
import { VizEngine } from "@/components/viz/viz-engine";

// Renders a material's compiled MDX body. A visualization is OPTIONAL for a
// material (R1), unlike an editorial, where a missing one is flagged as a
// content error. So:
//  - vizConfig "none": nothing is rendered for the visualization, and a stray
//    <Interactive /> in the body renders nothing;
//  - configured and <Interactive /> placed: the engine renders there;
//  - configured but the tag forgotten: the engine renders above the body with
//    a notice, mirroring EditorialMDX, rather than silently dropping it.
// Engines are code-split inside VizEngine, so a material without a
// visualization downloads none of them.
export function MaterialMDX({
  code,
  vizConfig,
}: {
  code: string;
  vizConfig: Material["vizConfig"];
}) {
  const t = useTranslations("materials");
  const Component = useMDXComponent(code);

  return useMemo(() => {
    const hasViz = vizConfig.discriminant !== "none";

    function Interactive() {
      if (!hasViz) return null;
      return (
        <div className="not-prose my-8">
          <VizEngine editorial={{ vizConfig }} />
        </div>
      );
    }

    const tree = Component({ components: { Interactive } }) as ReactNode;
    const embedsInteractive = usesMarker(tree, Interactive);

    return (
      <>
        {hasViz && !embedsInteractive && (
          <div className="not-prose my-8">
            <p className="label-code mb-2 text-amber-600">{t("vizFallbackNotice")}</p>
            <VizEngine editorial={{ vizConfig }} />
          </div>
        )}
        {tree}
      </>
    );
  }, [Component, vizConfig, t]);
}
