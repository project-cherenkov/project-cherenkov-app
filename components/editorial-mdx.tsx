"use client";

import { useMemo, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { Editorial } from "#content";

import { usesMarker } from "@/components/mdx-marker";
import { Solution, TryFirstToggle } from "@/components/solution-disclosure";
import { useMDXComponent } from "@/components/use-mdx-component";
import { VizEngine } from "@/components/viz/viz-engine";

type VizEditorial = Pick<Editorial, "vizConfig">;

// The `Interactive` component must be defined on the client side because
// React's Server/Client boundary forbids passing functions as props from
// a Server Component to a Client Component. By building the components
// map here — inside a "use client" module — we avoid that constraint.
//
// This component also owns the "author forgot to place <Interactive/>"
// fallback decision (moved here from the page, per F-05 — see usesMarker
// above). Contributors place <Interactive /> in their MDX body wherever it
// belongs in the hook → problem → idea → interactive → proof flow (spec
// §5). Since the site's own rule is that no editorial ships without one
// (spec §1, "non-negotiable"), a forgotten tag shouldn't silently mean no
// visualization — fall back to rendering it right before the body instead
// of hiding the gap.
export function EditorialMDX({
  code,
  vizConfig,
}: {
  code: string;
} & VizEditorial) {
  const t = useTranslations("editorial");
  const Component = useMDXComponent(code);

  return useMemo(() => {
    function Interactive() {
      return (
        <div className="not-prose my-8">
          <VizEngine editorial={{ vizConfig }} />
        </div>
      );
    }

    // Calling the compiled body directly (rather than only via
    // <Component components={{Interactive}} />) gives back the same
    // React element tree React would otherwise build during render —
    // Velite's compiled output always resolves to a plain function call
    // with no wrapper (see the `default` export in a compiled body: it
    // only wraps in a provider component if `props.components.wrapper`
    // is set, which it never is here). That tree is then rendered
    // directly below (`{tree}`), so the body is only evaluated once.
    const tree = Component({ components: { Interactive, Solution } }) as ReactNode;
    const embedsInteractive = usesMarker(tree, Interactive);
    // R5: offer the "try it first" switch only on pages that have a solution
    // to hide.
    const hasSolution = usesMarker(tree, Solution);
    // Split into two cases so we don't show two overlapping warnings: a
    // genuinely unconfigured engine ("none") already gets VizEngine's own
    // message (via hasMissingViz); this notice is only for "the engine IS
    // configured but nobody placed the tag."
    const forgotToEmbedTag = !embedsInteractive && vizConfig.discriminant !== "none";

    return (
      <>
        {hasSolution && <TryFirstToggle />}
        {!embedsInteractive && (
          <div className="not-prose my-8">
            {forgotToEmbedTag && (
              <p className="label-code mb-2 text-amber-600">{t("vizFallbackNotice")}</p>
            )}
            <VizEngine editorial={{ vizConfig }} />
          </div>
        )}
        {tree}
      </>
    );
  }, [Component, vizConfig, t]);
}
