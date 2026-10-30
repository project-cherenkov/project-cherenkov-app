"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Maximize2, Minimize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import { logStudySession } from "@/lib/study-session-actions";
import {
  TIMER_LIMITS,
  TIMER_PRESETS,
  TIMER_STORAGE_KEY,
  clampPreset,
  finish,
  focusTotalMs,
  formatClock,
  nextPhase,
  parseTimerState,
  pause,
  phaseElapsedMs,
  plannedMs,
  resume,
  settle,
  startTimer,
  type TimerPreset,
  type TimerState,
} from "@/lib/study-timer";
import { TopicPicker, type PickerPlanItem, type PickerSubject, type PickerValue } from "./topic-picker";

const EMPTY_TARGET: PickerValue = { subject: "", syllabusTopicId: "", planItemId: "" };

function readStored(): TimerState {
  try {
    const raw = window.localStorage.getItem(TIMER_STORAGE_KEY);
    return parseTimerState(raw ? JSON.parse(raw) : null, Date.now());
  } catch {
    return { status: "idle" };
  }
}

function writeStored(state: TimerState) {
  try {
    if (state.status === "idle") window.localStorage.removeItem(TIMER_STORAGE_KEY);
    else window.localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage blocked: the timer still works, it just will not survive a reload.
  }
}

// The study timer (R3). Everything about time lives in lib/study-timer.ts
// (pure, tested); this component only draws it and persists it.
//
//  - Signed in: a FINISHED session is sent to the server, which re-validates
//    it. Nothing is sent while the timer is running.
//  - Guest: the timer works the same, but nothing is stored anywhere except
//    this browser's localStorage, and that is cleared when the session ends.
//  - A phase never earns more than its planned length (see the state machine),
//    and the timer waits for the student rather than chaining blocks itself.
export function StudyTimer({
  signedIn,
  subjects,
  planItems,
  showFocusView = true,
}: {
  signedIn: boolean;
  subjects: PickerSubject[];
  planItems: PickerPlanItem[];
  showFocusView?: boolean;
}) {
  const t = useTranslations("timer");
  const [timer, setTimer] = useState<TimerState>({ status: "idle" });
  const [hydrated, setHydrated] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [preset, setPreset] = useState<TimerPreset>(TIMER_PRESETS[0]!);
  const [target, setTarget] = useState<PickerValue>(EMPTY_TARGET);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [fullscreen, setFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Restore a timer left running in this browser (a reload, a closed tab).
  useEffect(() => {
    setTimer(readStored());
    setNow(Date.now());
    setHydrated(true);
    const onStorage = (event: StorageEvent) => {
      if (event.key === TIMER_STORAGE_KEY) setTimer(readStored());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const apply = useCallback((next: TimerState) => {
    setTimer(next);
    writeStored(next);
    setNow(Date.now());
  }, []);

  // One tick a second while a phase is running; every tick settles a phase
  // that has reached its planned length.
  const running = timer.status === "active" && timer.runStartedAt !== null;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const at = Date.now();
      setNow(at);
      setTimer((prev) => {
        const settled = settle(prev, at);
        if (settled !== prev) writeStored(settled);
        return settled;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Show the countdown in the tab title so it is visible from other tabs.
  useEffect(() => {
    if (!showFocusView || timer.status !== "active") return;
    const base = document.title;
    const left = plannedMs(timer) - phaseElapsedMs(timer, now);
    document.title = `${formatClock(left)} · ${t(timer.phase === "focus" ? "phaseFocus" : "phaseBreak")}`;
    return () => {
      document.title = base;
    };
  }, [timer, now, t, showFocusView]);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void containerRef.current?.requestFullscreen?.();
  }

  function start() {
    setMessage(null);
    apply(
      startTimer(Date.now(), clampPreset(preset), {
        subject: target.subject || null,
        syllabusTopicId: target.syllabusTopicId || null,
        planItemId: target.planItemId || null,
      }),
    );
  }

  function discard() {
    setMessage(null);
    apply({ status: "idle" });
  }

  function endSession() {
    if (timer.status !== "active") return;
    const at = Date.now();
    const frozen = pause(timer, at); // stop the clock while we save
    const result = finish(frozen, at);
    if (!result) return;
    const minutes = Math.round(result.durationSeconds / 60);

    if (!signedIn) {
      apply({ status: "idle" });
      setMessage({ kind: "ok", text: t("savedGuest", { minutes }) });
      return;
    }
    if (result.durationSeconds < 60) {
      apply({ status: "idle" });
      setMessage({ kind: "error", text: t("tooShort") });
      return;
    }
    apply(frozen);
    startTransition(async () => {
      const response = await logStudySession({
        startedAtMs: result.startedAt,
        durationSeconds: result.durationSeconds,
        source: "timer",
        subject: result.target.subject,
        syllabusTopicId: result.target.syllabusTopicId,
        planItemId: result.target.planItemId,
      });
      if (response.ok) {
        apply({ status: "idle" });
        setMessage({ kind: "ok", text: t("saved", { minutes }) });
      } else {
        // Keep the (paused) timer so no time is lost; the student can retry
        // or discard it.
        setMessage({ kind: "error", text: t(`errors.${response.reason}`) });
      }
    });
  }

  if (!hydrated) {
    return <div className="min-h-64" aria-busy="true" />;
  }

  const isActive = timer.status === "active";
  const planned = isActive ? plannedMs(timer) : 0;
  const elapsed = isActive ? phaseElapsedMs(timer, now) : 0;
  const complete = isActive && timer.phaseComplete;
  const paused = isActive && timer.runStartedAt === null && !timer.phaseComplete;
  const focusMinutes = isActive ? Math.floor(focusTotalMs(timer, now) / 60_000) : 0;

  return (
    <div
      ref={containerRef}
      className={
        fullscreen
          ? "flex min-h-screen flex-col items-center justify-center gap-8 bg-background p-8"
          : "space-y-6"
      }
    >
      {isActive ? (
        <section aria-label={t("title")} className="space-y-4 text-center">
          <p className="label-code">{t(timer.phase === "focus" ? "phaseFocus" : "phaseBreak")}</p>
          {/* aria-live off: a clock that talks every second is unusable with a
              screen reader. Phase changes are announced in the status below. */}
          <p
            role="timer"
            aria-live="off"
            className={`font-mono font-bold tabular-nums text-foreground ${fullscreen ? "text-9xl" : "text-7xl"}`}
          >
            {formatClock(planned - elapsed)}
          </p>
          <p className="text-sm text-muted-foreground">{t("elapsedFocus", { minutes: focusMinutes })}</p>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {!complete ? (
              paused ? (
                <Button onClick={() => apply(resume(timer, Date.now()))}>{t("resume")}</Button>
              ) : (
                <Button variant="outline" onClick={() => apply(pause(timer, Date.now()))}>
                  {t("pause")}
                </Button>
              )
            ) : null}
            <Button
              variant={complete ? "default" : "outline"}
              onClick={() => apply(nextPhase(timer, Date.now()))}
            >
              {timer.phase === "focus"
                ? complete
                  ? t("startBreak")
                  : t("skipToBreak")
                : complete
                  ? t("nextFocus")
                  : t("skipBreak")}
            </Button>
            <Button variant="outline" onClick={endSession} disabled={pending}>
              {t("finish")}
            </Button>
            <Button variant="ghost" onClick={discard} disabled={pending}>
              {t("discard")}
            </Button>
          </div>
        </section>
      ) : (
        <section className="space-y-5">
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-foreground">{t("presetsLabel")}</legend>
            <div className="flex flex-wrap gap-2">
              {TIMER_PRESETS.map((option) => {
                const selected = option.focusMin === preset.focusMin && option.breakMin === preset.breakMin;
                return (
                  <button
                    key={`${option.focusMin}-${option.breakMin}`}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setPreset(option)}
                    className={[
                      "min-h-10 rounded-md border px-3 text-sm font-medium",
                      selected
                        ? "border-cherenkov-blue-800 bg-cherenkov-blue-800 text-white dark:border-cherenkov-blue-pastel dark:bg-cherenkov-blue-pastel dark:text-cherenkov-ink"
                        : "border-border text-foreground hover:bg-muted",
                    ].join(" ")}
                  >
                    {t("preset", { focus: option.focusMin, rest: option.breakMin })}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
              <label className="space-y-1 text-sm">
                <span className="font-medium text-foreground">{t("customFocus")}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={TIMER_LIMITS.minFocusMin}
                  max={TIMER_LIMITS.maxFocusMin}
                  value={preset.focusMin}
                  onChange={(event) => setPreset({ ...preset, focusMin: Number(event.target.value) })}
                  onBlur={() => setPreset(clampPreset(preset))}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium text-foreground">{t("customBreak")}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={TIMER_LIMITS.minBreakMin}
                  max={TIMER_LIMITS.maxBreakMin}
                  value={preset.breakMin}
                  onChange={(event) => setPreset({ ...preset, breakMin: Number(event.target.value) })}
                  onBlur={() => setPreset(clampPreset(preset))}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
                />
              </label>
            </div>
          </fieldset>

          <TopicPicker
            subjects={subjects}
            planItems={planItems}
            value={target}
            onChange={setTarget}
          />

          <Button onClick={start}>{t("start")}</Button>
          {!signedIn ? (
            <p className="text-sm text-muted-foreground">
              {t("guestNote")}{" "}
              <Link href="/login" className="underline underline-offset-4">
                {t("signInToLog")}
              </Link>
            </p>
          ) : null}
        </section>
      )}

      {/* One polite region announces phase changes and results. */}
      <div role="status" aria-live="polite" className="min-h-6 text-sm">
        {complete ? (
          <p className="font-medium text-foreground">
            {t(timer.status === "active" && timer.phase === "focus" ? "focusComplete" : "breakComplete")}
          </p>
        ) : null}
        {message ? (
          <p
            className={
              message.kind === "ok"
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }
          >
            {message.text}
          </p>
        ) : null}
      </div>

      {showFocusView ? (
        <button
          type="button"
          onClick={toggleFullscreen}
          className="inline-flex min-h-10 items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {fullscreen ? <Minimize2 aria-hidden className="h-4 w-4" /> : <Maximize2 aria-hidden className="h-4 w-4" />}
          {fullscreen ? t("exitFocusView") : t("focusView")}
        </button>
      ) : null}
    </div>
  );
}
