"use client";

import { useId, useRef, useState, type KeyboardEvent, type TouchEvent } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/routing";
import { useSession } from "@/lib/auth-client";
import { VizEngine } from "@/components/viz/viz-engine";
import { HomeVizChooser } from "@/components/site/home-viz-chooser";
import { useHomeVizPicks } from "@/components/site/use-home-viz-picks";
import type { HomeVizCandidate } from "@/lib/home-viz-candidates";
import { resolveHomeVizPicks } from "@/lib/home-viz-picks";

// The home hero's visualizations: one to three the visitor has chosen, shown
// one at a time. On wide screens the picker and its caption share the top row
// with the hero text, and the stage spans the full row below.
//
// The picks come from `candidates`, built on the server from the published
// editorials (lib/home-viz-candidates.ts), so nothing here keeps its own copy
// of a visualization's configuration.
//
// Every pick is mounted at once and the inactive ones are hidden; the reason
// is in the comment above the stage.
export function HomeVisualizations({ candidates }: { candidates: HomeVizCandidate[] }) {
  const t = useTranslations("home.visualizations");
  const locale = useLocale();
  const { data: session } = useSession();
  const { saved, ready, save } = useHomeVizPicks(Boolean(session));
  const baseId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const byKey = new Map(candidates.map((candidate) => [candidate.key, candidate]));
  const pickKeys = resolveHomeVizPicks(saved, [...byKey.keys()]);
  const picks = pickKeys.map((key) => byKey.get(key)!);
  const activeIndex = Math.max(0, pickKeys.indexOf(activeKey ?? ""));
  const active = picks[activeIndex];

  if (!active) return null;

  const subjectLabel = (subject: HomeVizCandidate["subject"]) => t(subject);
  const tabId = (key: string) => `${baseId}-tab-${key.replace("/", "-")}`;
  const panelId = `${baseId}-panel`;

  function select(index: number) {
    const next = picks[(index + picks.length) % picks.length];
    if (next) setActiveKey(next.key);
  }

  // Arrow keys move focus between the tabs; Enter or Space (a button's own
  // behaviour) selects. Switching mounts an engine, so it is not done on focus.
  function handleTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key)) return;
    const current = tabRefs.current.findIndex((el) => el === document.activeElement);
    if (current < 0) return;
    event.preventDefault();
    let target = current;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") target = current + 1;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") target = current - 1;
    if (event.key === "Home") target = 0;
    if (event.key === "End") target = picks.length - 1;
    tabRefs.current[(target + picks.length) % picks.length]?.focus();
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    setTouchStart(event.changedTouches[0]?.clientX ?? null);
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (touchStart === null) return;
    const touchX = event.changedTouches[0]?.clientX;
    if (touchX === undefined) return;
    const distance = touchX - touchStart;
    if (Math.abs(distance) >= 40) select(activeIndex + (distance > 0 ? -1 : 1));
    setTouchStart(null);
  }

  const titleLang = (candidate: HomeVizCandidate) =>
    candidate.titleLang === locale ? undefined : candidate.titleLang;
  const descLang = (candidate: HomeVizCandidate) =>
    candidate.descriptionLang === locale ? undefined : candidate.descriptionLang;

  return (
    <div className="contents">
      <section
        aria-labelledby={`${baseId}-picks-heading`}
        className="min-w-0 lg:col-start-2 lg:row-start-1"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 id={`${baseId}-picks-heading`} className="label-code">
              {t("picks.title")}
            </h2>
            {candidates.length > 1 ? (
              <HomeVizChooser
                candidates={candidates}
                picks={pickKeys}
                hasSavedChoice={saved !== null}
                subjectLabel={subjectLabel}
                onSave={save}
                onUseDefaults={() => {
                  save(null);
                  setActiveKey(null);
                }}
              />
            ) : null}
          </div>
          {picks.length > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => select(activeIndex - 1)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border text-lg text-foreground hover:bg-muted"
                aria-label={t("previous")}
              >
                <span aria-hidden="true">←</span>
              </button>
              <button
                type="button"
                onClick={() => select(activeIndex + 1)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border text-lg text-foreground hover:bg-muted"
                aria-label={t("next")}
              >
                <span aria-hidden="true">→</span>
              </button>
            </div>
          )}
        </div>

        {/* One scrolling row on a phone; on wider screens the tabs share the
            width. Attached to the stage below, so choosing and viewing are one
            gesture. */}
        <div
          role="tablist"
          aria-label={t("picks.tablistLabel")}
          onKeyDown={handleTabKeyDown}
          className="mt-2 flex gap-2 overflow-x-auto pb-1 lg:overflow-visible lg:pb-0"
        >
          {picks.map((candidate, index) => {
            const selected = index === activeIndex;
            return (
              <button
                key={candidate.key}
                ref={(el) => {
                  tabRefs.current[index] = el;
                }}
                type="button"
                role="tab"
                id={tabId(candidate.key)}
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveKey(candidate.key)}
                className={[
                  "min-h-11 w-44 shrink-0 rounded-md border px-3 py-2 text-left transition-colors lg:w-0 lg:flex-1",
                  selected
                    ? "border-brand bg-card shadow-sm"
                    : "border-border hover:bg-muted",
                ].join(" ")}
              >
                <span
                  lang={titleLang(candidate)}
                  className={`line-clamp-2 block text-sm leading-snug ${selected ? "font-semibold" : "font-medium"}`}
                >
                  {candidate.title}
                </span>
                <span className="label-mono block">{subjectLabel(candidate.subject)}</span>
              </button>
            );
          })}
        </div>

        {/* The caption stays with the picker on wide screens, before the
            full-width stage. */}
        <div className="mt-3 text-sm lg:mt-3">
          {active.description && (
            <p lang={descLang(active)} className="max-w-prose leading-snug text-foreground/80">
              {active.description}
            </p>
          )}
          <Link
            href={`/archive/${active.subject}/${active.slug}`}
            className="mt-1 inline-flex min-h-11 items-center font-medium text-brand underline-offset-4 hover:underline"
          >
            {t("picks.openEditorial")}
            <span className="sr-only">: </span>
            <span lang={titleLang(active)} className="sr-only">
              {active.title}
            </span>
          </Link>
        </div>
      </section>

      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={tabId(active.key)}
        aria-busy={!ready}
        className="mt-3 min-w-0 lg:col-span-2 lg:col-start-1 lg:row-start-2"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* All the picks (at most three) are mounted in ONE grid cell and the
            inactive ones are hidden, so the stage is always as tall as the
            tallest pick and does not change height as the visitor switches
            (the layout shift fixed in docs/reviews/audit-2026-10-31.md). This
            is not optional: the engines differ a lot in height. Measured in a
            browser at 1280 px: projectile and binary search 596 px, eccentric
            orbit 599, blackbody 827, sidereal day 1190. A hidden engine keeps
            its slider state, so switching back finds it as it was.

            STAGE_MIN_HEIGHT: the floor below is the loaded height of the three
            default picks. A visitor whose picks are taller still sees one jump
            when the engines replace their skeletons. */}
        <div className="grid min-h-[34rem] min-w-0 sm:min-h-[33rem]">
          {picks.map((candidate, index) => {
            const isActive = index === activeIndex;
            return (
              <div
                key={candidate.key}
                inert={!isActive}
                aria-hidden={isActive ? undefined : true}
                className={`col-start-1 row-start-1 flex min-w-0 flex-col [&>div:last-child]:grow ${
                  isActive ? "" : "invisible"
                }`}
              >
                <h3 lang={titleLang(candidate)} className="text-lg font-semibold text-foreground">
                  {candidate.title}
                </h3>
                <p className="mb-3 text-sm text-muted-foreground">{subjectLabel(candidate.subject)}</p>
                {ready ? (
                  <VizEngine
                    editorial={{ vizConfig: candidate.vizConfig }}
                    contentLang={descLang(candidate)}
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="animate-pulse rounded-lg border border-border bg-card"
                  />
                )}
              </div>
            );
          })}
        </div>

        <p role="status" className="sr-only">
          {`${active.title}: ${activeIndex + 1} ${t("of")} ${picks.length}`}
        </p>
      </div>
    </div>
  );
}
