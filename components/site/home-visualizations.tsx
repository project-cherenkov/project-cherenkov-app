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

// The step notes are read aloud and shown on screen, so they come from the
// message catalogue (home.visualizations.binarySearchNotes) in the page's own
// language. They used to be hard-coded English, which also made the Indonesian
// home page announce English text without a lang attribute (WCAG 3.1.2).
const BINARY_SEARCH_STEPS = [
  { pointers: { lo: 0, mid: 4 }, highlight: [4] },
  { pointers: { lo: 0, hi: 4, mid: 2 }, highlight: [2] },
  { pointers: { lo: 3, hi: 4, mid: 3 }, highlight: [3] },
  { pointers: { lo: 4, hi: 4 }, highlight: [4] },
];

export function HomeVisualizations() {
  const t = useTranslations("home");
  const [activeIndex, setActiveIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const binarySearch = {
    discriminant: "graph-array-stepper" as const,
    value: {
      array: [2, 4, 6, 8, 10, 12, 14, 16],
      steps: BINARY_SEARCH_STEPS.map((step, index) => ({
        ...step,
        note: t(`visualizations.binarySearchNotes.${index}`),
      })),
    },
  };

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

  const active = slides[activeIndex] ?? slides[0]!;

  return (
    <div
      className="min-w-0"
      role="group"
      aria-roledescription="carousel"
      aria-label={t("visualizations.slides")}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="label-code">{t("visualizations.eyebrow")}</p>
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

      {/* Layout-stable stage. Every slide sits in the SAME grid cell and the
          inactive ones are only hidden with `visibility`, so the stage is
          always as tall as the tallest slide at the current width, whichever
          slide is showing. Before this, the stage took the height of the one
          visible simulation (three very different heights), and the hero's
          vertically centred text column, the heading and everything below
          the hero moved every time the slide changed. Inactive slides are
          `inert` + aria-hidden, so they are neither focusable nor announced.
          The engines are idle until played (no autoplay), so keeping all
          three mounted costs three small chunks, not three animation loops. */}
      {/* min-h ≈ the loaded height of the stage (measured: ~600px, ~655px when
          the sliders stack on a phone), so the hero does not jump by ~350px
          when the three engine chunks arrive and replace their skeletons. */}
      <div className="grid min-h-[41rem] sm:min-h-[37.25rem]">
        {slides.map((slide, index) => {
          const isActive = index === activeIndex;
          return (
            <div
              key={slide.label}
              role="group"
              aria-roledescription="slide"
              aria-label={slide.ariaLabel}
              aria-hidden={isActive ? undefined : true}
              inert={!isActive}
              className={[
                "col-start-1 row-start-1 flex min-w-0 flex-col [&>div:last-child]:grow",
                isActive ? "" : "invisible",
              ].join(" ")}
            >
              <h2 className="text-lg font-semibold text-foreground">{slide.label}</h2>
              <p className="mb-3 text-sm text-muted-foreground">{slide.subject}</p>
              <VizEngine editorial={{ vizConfig: slide.config }} />
            </div>
          );
        })}
      </div>

      <p role="status" className="sr-only">
        {`${active.label}: ${activeIndex + 1} ${t("visualizations.of")} ${slides.length}`}
      </p>

      <div className="mt-2 flex justify-center">
        {slides.map((item, index) => (
          <button
            key={item.label}
            type="button"
            onClick={() => setActiveIndex(index)}
            aria-label={`${item.label}: ${index + 1} ${t("visualizations.of")} ${slides.length}`}
            aria-current={index === activeIndex ? "true" : undefined}
            // A 10px dot is a 10px target (WCAG 2.5.8 asks for 24px). The
            // button is 40px square and the dot is drawn inside it, so the
            // look is unchanged and the hit area is not.
            className="group inline-flex h-10 w-10 items-center justify-center"
          >
            <span
              aria-hidden="true"
              className={[
                "h-2.5 w-2.5 rounded-full border border-brand transition-colors group-hover:bg-brand/40",
                index === activeIndex ? "bg-brand" : "bg-transparent",
              ].join(" ")}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
