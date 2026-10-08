"use client";

import { Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface PlaybackControlsProps {
  /** Current position — a step index for discrete engines, or a 0–1000
   *  normalized time for continuous ones (see trajectory/orbital engines). */
  current: number;
  total: number;
  isPlaying: boolean;
  onPlayPause: () => void;
  onStep: (direction: -1 | 1) => void;
  onScrub: (value: number) => void;
  onReset: () => void;
  /** e.g. "Step 3 of 8" vs "t = 1.4s" — engine-specific formatting. */
  label: string;
}

// Shared by all three viz engines (spec §7: "playback controls
// (play/pause/step/scrub)") so the control surface feels identical whether
// you're stepping through a DP table or scrubbing a projectile's flight.
export function PlaybackControls({
  current,
  total,
  isPlaying,
  onPlayPause,
  onStep,
  onScrub,
  onReset,
  label,
}: PlaybackControlsProps) {
  const t = useTranslations("viz");

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label={t("stepBack")}
            onClick={() => onStep(-1)}
          >
            <SkipBack className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="default"
            size="icon"
            aria-label={isPlaying ? t("pause") : t("play")}
            onClick={onPlayPause}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Play className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={t("stepForward")}
            onClick={() => onStep(1)}
          >
            <SkipForward className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("reset")}
            onClick={onReset}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        {/* Announced politely when the reader steps or scrubs. While the
            visualization is auto-playing the label changes every frame, which
            would make a screen reader read out "t = 1.42s … 1.43s …"
            continuously — so the region goes quiet during playback. */}
        <span className="label-code" role="status" aria-live={isPlaying ? "off" : "polite"}>
          {label}
        </span>
      </div>

      <Slider
        aria-label={t("scrub")}
        min={0}
        max={total}
        step={1}
        value={[current]}
        onValueChange={([v]) => onScrub(v ?? 0)}
      />
    </div>
  );
}
