"use client";

import { scaleBand } from "d3";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { PlaybackControls } from "@/components/viz/playback-controls";
import { MarkdownText } from "@/components/viz/shared/markdown-text";
import type { GraphArrayStepperConfig } from "./types";

const STEP_INTERVAL_MS = 900;
const CELL_HEIGHT = 44;

export function GraphArrayStepper({
  config,
}: {
  config: GraphArrayStepperConfig;
}) {
  const { array, steps } = config;
  const t = useTranslations("viz");

  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [width, setWidth] = useState(320);
  const containerRef = useRef<HTMLDivElement>(null);

  // Canvas-that-scales-to-container-width, SVG flavor (spec §7: mobile-first,
  // must not overflow small screens).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Autoplay.
  useEffect(() => {
    if (!isPlaying) return;
    if (stepIndex >= steps.length - 1) {
      setIsPlaying(false);
      return;
    }
    const id = setTimeout(() => setStepIndex((i) => i + 1), STEP_INTERVAL_MS);
    return () => clearTimeout(id);
  }, [isPlaying, stepIndex, steps.length]);

  const step = steps[stepIndex];
  const highlight = new Set(step?.highlight ?? []);

  // D3 owns the math (scale/positioning per spec §3 & §7); React owns every
  // DOM node — D3 never touches the DOM directly, which keeps it safe to mix
  // with React's own reconciliation.
  const scale = scaleBand<number>()
    .domain(array.map((_, i) => i))
    .range([0, width])
    .padding(0.14);
  const cellWidth = scale.bandwidth();

  // Group pointers that land on the same index so labels don't overlap.
  const pointersByIndex = new Map<number, string[]>();
  for (const [name, idx] of Object.entries(step?.pointers ?? {})) {
    const list = pointersByIndex.get(idx) ?? [];
    list.push(name);
    pointersByIndex.set(idx, list);
  }

  function clampStep(next: number) {
    setStepIndex(Math.min(Math.max(next, 0), steps.length - 1));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* my-auto: when a parent stretches this card (the home carousel gives
          every slide the same height) the array and its note sit in the middle
          of the spare space instead of leaving a hole above the controls. In
          normal flow there is no spare space and this does nothing. */}
      <div className="my-auto flex flex-col gap-4">
        <div ref={containerRef} className="w-full overflow-x-auto">
          <svg
            width={width}
            height={CELL_HEIGHT + 40}
            role="img"
            aria-label={step?.note ?? t("stepCounter", { current: stepIndex + 1, total: steps.length })}
          >
            {array.map((value, i) => {
              const x = scale(i) ?? 0;
              const isHighlighted = highlight.has(i);
              return (
                <g key={i} transform={`translate(${x}, 0)`}>
                  <rect
                    width={cellWidth}
                    height={CELL_HEIGHT}
                    y={28}
                    rx={6}
                    className={
                      isHighlighted
                        ? "fill-cherenkov-blue stroke-cherenkov-blue-pastel"
                        : "fill-card stroke-border-strong"
                    }
                    strokeWidth={isHighlighted ? 2 : 1}
                  />
                  <text
                    x={cellWidth / 2}
                    y={28 + CELL_HEIGHT / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className={`${isHighlighted ? "fill-cherenkov-ink" : "fill-foreground"} font-mono text-sm`}
                  >
                    {value}
                  </text>
                  {pointersByIndex.get(i) && (
                    <text
                      x={cellWidth / 2}
                      y={16}
                      textAnchor="middle"
                      // Pointer names are variable names (i, j, lo, hi): never uppercase them.
                      className="fill-muted-foreground font-mono text-xs"
                    >
                      {pointersByIndex.get(i)!.join("/")}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Every step's note shares one grid cell and only the current one is
            visible, so the block is as tall as the LONGEST note and does not
            change height from step to step (a note that wraps to a second line
            used to push the controls, and the page below, down and back up). */}
        {steps.some((s) => s.note) && (
          <div className="grid">
            {steps.map((s, i) =>
              s.note ? (
                <div
                  key={i}
                  aria-hidden={i === stepIndex ? undefined : true}
                  className={`col-start-1 row-start-1 ${i === stepIndex ? "" : "invisible"}`}
                >
                  <MarkdownText text={s.note} className="text-sm text-foreground/75" />
                </div>
              ) : null,
            )}
          </div>
        )}
      </div>

      <PlaybackControls
        current={stepIndex}
        total={Math.max(steps.length - 1, 0)}
        isPlaying={isPlaying}
        onPlayPause={() => setIsPlaying((p) => !p)}
        onStep={(dir) => {
          setIsPlaying(false);
          clampStep(stepIndex + dir);
        }}
        onScrub={(v) => {
          setIsPlaying(false);
          clampStep(v);
        }}
        onReset={() => {
          setIsPlaying(false);
          setStepIndex(0);
        }}
        label={t("stepCounter", { current: stepIndex + 1, total: steps.length })}
      />
    </div>
  );
}
