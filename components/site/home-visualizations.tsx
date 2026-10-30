"use client";

import { useState, type TouchEvent } from "react";
import { useTranslations } from "next-intl";
import { VizEngine } from "@/components/viz/viz-engine";

const projectile = {
  discriminant: "trajectory-sandbox" as const,
  value: {
    physicsType: "projectile" as const,
    gravity: 9.8,
    initial: { speed: 20, angleDeg: 30 },
    speedRange: [5, 40] as [number, number],
    angleRange: [5, 85] as [number, number],
  },
};

const orbit = {
  discriminant: "orbital-sandbox" as const,
  value: {
    eccentricity: 0.3,
    semiMajorAxisPx: 130,
    periodSeconds: 6,
    massRatio: 0.05,
    transitDepth: 0.015,
    eccentricityRange: [0, 0.8] as [number, number],
    massRatioRange: [0, 0.15] as [number, number],
  },
};

const binarySearch = {
  discriminant: "graph-array-stepper" as const,
  value: {
    array: [2, 4, 6, 8, 10, 12, 14, 16],
    steps: [
      { pointers: { lo: 0, mid: 4 }, highlight: [4], note: "The midpoint is 10: the answer is here or before it." },
      { pointers: { lo: 0, hi: 4, mid: 2 }, highlight: [2], note: "6 is too small, so discard the left half." },
      { pointers: { lo: 3, hi: 4, mid: 3 }, highlight: [3], note: "8 is too small, so move the lower bound forward." },
      { pointers: { lo: 4, hi: 4 }, highlight: [4], note: "The bounds meet at the first value that is at least 10." },
    ],
  },
};

export function HomeVisualizations() {
  const t = useTranslations("home");
  const [activeIndex, setActiveIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const slides = [
    {
      subject: t("visualizations.physics"),
      label: t("visualizations.projectile"),
      ariaLabel: t("visualizations.projectileAria"),
      config: projectile,
    },
    {
      subject: t("visualizations.astronomy"),
      label: t("visualizations.orbit"),
      ariaLabel: t("visualizations.orbitAria"),
      config: orbit,
    },
    {
      subject: t("visualizations.informatics"),
      label: t("visualizations.binarySearch"),
      ariaLabel: t("visualizations.binarySearchAria"),
      config: binarySearch,
    },
  ];

  function move(direction: 1 | -1) {
    setActiveIndex((index) => (index + direction + slides.length) % slides.length);
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    setTouchStart(event.changedTouches[0]?.clientX ?? null);
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (touchStart === null) return;
    const touchX = event.changedTouches[0]?.clientX;
    if (touchX === undefined) return;
    const distance = touchX - touchStart;
    if (Math.abs(distance) >= 40) move(distance > 0 ? -1 : 1);
    setTouchStart(null);
  }

  const slide = slides[activeIndex] ?? slides[0]!;

  return (
    <div
      className="min-w-0"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="label-code">{t("visualizations.eyebrow")}</p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">
            {slide.label}
          </h2>
          <p className="text-sm text-muted-foreground">{slide.subject}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => move(-1)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border text-lg text-foreground hover:bg-muted"
            aria-label={t("visualizations.previous")}
          >
            <span aria-hidden="true">←</span>
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border text-lg text-foreground hover:bg-muted"
            aria-label={t("visualizations.next")}
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
      <div
        className="overflow-hidden"
        aria-live="polite"
        aria-label={slide.ariaLabel}
      >
        <VizEngine editorial={{ vizConfig: slide.config }} />
      </div>
      <div className="mt-3 flex justify-center gap-2" aria-label={t("visualizations.slides")}>
        {slides.map((item, index) => (
          <button
            key={item.label}
            type="button"
            onClick={() => setActiveIndex(index)}
            aria-label={`${item.label}: ${index + 1} ${t("visualizations.of")} ${slides.length}`}
            aria-current={index === activeIndex ? "true" : undefined}
            className={[
              "h-2.5 w-2.5 rounded-full border border-brand transition-colors",
              index === activeIndex ? "bg-brand" : "bg-transparent",
            ].join(" ")}
          />
        ))}
      </div>
    </div>
  );
}
