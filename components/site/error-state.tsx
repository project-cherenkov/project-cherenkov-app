"use client";

import { useEffect, useId, useState, type CSSProperties, type ReactNode } from "react";
import { Link, usePathname } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { fillFlavour, pickFragment } from "@/lib/error-flavour";

export interface ErrorStateProps {
  eyebrow?: string;
  /** The large glitching characters ("404", "ERR"). Decorative: the heading carries the meaning. */
  code?: string;
  heading: string;
  body: string;
  ctaLabel: string;
  ctaHref?: string;
  onRetry?: () => void;
  illustration?: ReactNode;
  /** Candidate lines for the extra flavour line. Edited in lib/error-flavour.ts. */
  flavour?: readonly string[];
  /** Label of the button that swaps the flavour line for another one. */
  anotherLabel?: string;
  /** Fill {path} in the flavour lines with the address the visitor asked for. */
  echoPath?: boolean;
}

// [left, top, width, height, tone, drift, delay, duration, opacity]
// Percentages of the field; `drift` is how far a block jumps sideways. The
// middle band is left to the text panel, so most blocks hug the top and bottom.
// The tones (ink, deep, blue, pale, pink) take their colours from the .corrupt
// variables in app/globals.css, which differ between the light and dark theme.
const FRAGMENTS: ReadonlyArray<readonly [number, number, number, number, string, string, string, string, number]> = [
  [0, 0, 100, 9, "ink", "4%", "-0.4s", "3.6s", 0.9],
  [6, 8, 58, 7, "pink", "-8%", "-1.9s", "4.3s", 0.85],
  [52, 6, 48, 12, "blue", "7%", "-0.9s", "5.2s", 0.9],
  [0, 15, 30, 14, "pale", "-6%", "-2.6s", "3.9s", 0.9],
  [70, 20, 30, 10, "deep", "9%", "-1.3s", "4.7s", 0.85],
  [0, 36, 14, 22, "blue", "-5%", "-3.1s", "5.6s", 0.8],
  [86, 40, 14, 26, "pink", "6%", "-0.2s", "4.4s", 0.8],
  [0, 62, 22, 12, "ink", "-7%", "-2.2s", "3.7s", 0.85],
  [64, 70, 36, 11, "pale", "8%", "-1.1s", "5.0s", 0.9],
  [0, 80, 60, 8, "blue", "-9%", "-3.4s", "4.1s", 0.9],
  [40, 86, 60, 7, "deep", "5%", "-0.7s", "3.4s", 0.8],
  [0, 92, 100, 8, "ink", "-4%", "-2.9s", "4.9s", 0.9],
];

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// The shared 404 / error screen. The corruption is decorative: aria-hidden
// blocks animated with CSS alone (styles under .corrupt in app/globals.css),
// never over the text panel and never taking pointer events. With reduced
// motion it is a still image.
//
// The address and the random flavour line are only filled in after the page
// has loaded: the HTML is rendered before the browser knows which line was
// picked, and a different line on the server and the client would not match.
export function ErrorState({
  eyebrow,
  code,
  heading,
  body,
  ctaLabel,
  ctaHref,
  onRetry,
  illustration,
  flavour,
  anotherLabel,
  echoPath = false,
}: ErrorStateProps) {
  const titleId = useId();
  const pathname = usePathname();
  const lines = flavour ?? [];

  // null until the page has loaded, then a random line.
  const [index, setIndex] = useState<number | null>(null);
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    if (lines.length > 0) setIndex(pickFragment(lines.length));
  }, [lines.length]);

  async function showAnother() {
    setSettling(true); // a short burst of extra jitter, so the swap reads as part of the effect
    await wait(220);
    setIndex((current) => pickFragment(lines.length, current ?? -1));
    setSettling(false);
  }

  const line = index === null || lines.length === 0 ? "" : fillFlavour(lines[index] ?? "", echoPath ? (pathname ?? "") : "");

  return (
    <section
      aria-labelledby={titleId}
      className="corrupt mx-auto my-8 max-w-3xl sm:my-12"
      data-settling={settling || undefined}
    >
      <div className="cx-layer" aria-hidden="true">
        {FRAGMENTS.map(([x, y, w, h, tone, dx, delay, dur, o], i) => (
          <span
            key={i}
            className={`cx-frag cx-tone-${tone}`}
            style={
              {
                "--x": `${x}%`,
                "--y": `${y}%`,
                "--w": `${w}%`,
                "--h": `${h}%`,
                "--dx": dx,
                "--delay": delay,
                "--dur": dur,
                "--o": o,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div className="cx-panel">
        {eyebrow && <p className="label-pixel mb-2" aria-hidden="true">{eyebrow}</p>}
        {code && (
          <p className="cx-code font-heading" data-text={code} aria-hidden="true">
            {code}
          </p>
        )}
        {illustration && <div className="mb-4">{illustration}</div>}
        <h1 id={titleId} className="font-pixel text-2xl font-bold text-foreground sm:text-3xl">
          {heading}
        </h1>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-foreground/75">{body}</p>

        {lines.length > 0 && (
          <p className="cx-flavour font-mono" aria-live="polite">
            {line}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          {ctaHref ? (
            <Link
              href={ctaHref}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-cherenkov-blue px-4 py-2 text-sm font-medium text-cherenkov-ink transition-colors hover:bg-cherenkov-blue-pastel focus-visible:outline-none"
            >
              {ctaLabel}
            </Link>
          ) : onRetry ? (
            <Button onClick={onRetry}>{ctaLabel}</Button>
          ) : null}
          {lines.length > 1 && anotherLabel && (
            <Button variant="outline" onClick={showAnother}>
              {anotherLabel}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
