// The study timer's state machine (R3). Pure: no DOM, no clock — every
// function takes `now` (epoch ms), so it can be tested exactly.
//
// Design rules, each one is a way a naive timer goes wrong:
//  - Time is computed from timestamps, never by counting ticks, so a refresh,
//    a sleeping laptop or a throttled background tab cannot corrupt it.
//  - A phase can never be credited with more than its planned length. If the
//    machine sleeps through a 90-minute block for five hours, the block is
//    credited 90 minutes, not five hours, and the timer stops to wait for the
//    student instead of chaining blocks on its own.
//  - A clock that jumps backwards adds nothing (never negative time).
//  - Only FOCUS time is study time; breaks are never logged.
//
// State is plain JSON so the browser can keep it in localStorage across
// reloads. parseTimerState() treats whatever it reads back as untrusted.

export const TIMER_LIMITS = {
  minFocusMin: 1,
  maxFocusMin: 180,
  minBreakMin: 1,
  maxBreakMin: 60,
} as const;

export interface TimerPreset {
  focusMin: number;
  breakMin: number;
}

// 25/5, 50/10 and 90/5 are the starting presets; the student can edit them.
export const TIMER_PRESETS: readonly TimerPreset[] = [
  { focusMin: 25, breakMin: 5 },
  { focusMin: 50, breakMin: 10 },
  { focusMin: 90, breakMin: 5 },
];

export interface TimerTarget {
  subject: string | null;
  syllabusTopicId: string | null;
  planItemId: string | null;
}

export type TimerPhase = "focus" | "break";

export type TimerState =
  | { status: "idle" }
  | {
      status: "active";
      preset: TimerPreset;
      target: TimerTarget;
      // When the whole session began (becomes study_sessions.started_at).
      sessionStartedAt: number;
      phase: TimerPhase;
      // Start of the current running stretch; null while paused or finished.
      runStartedAt: number | null;
      // Time already banked in this phase before the current stretch.
      phaseAccruedMs: number;
      // Focus time from COMPLETED focus phases of this session.
      focusDoneMs: number;
      // True once the phase reached its planned length and froze.
      phaseComplete: boolean;
    };

type Active = Extract<TimerState, { status: "active" }>;

const MIN = 60_000;

export function clampPreset(preset: TimerPreset): TimerPreset {
  const clamp = (value: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, Math.round(Number.isFinite(value) ? value : lo)));
  return {
    focusMin: clamp(preset.focusMin, TIMER_LIMITS.minFocusMin, TIMER_LIMITS.maxFocusMin),
    breakMin: clamp(preset.breakMin, TIMER_LIMITS.minBreakMin, TIMER_LIMITS.maxBreakMin),
  };
}

export function plannedMs(state: Active): number {
  return (state.phase === "focus" ? state.preset.focusMin : state.preset.breakMin) * MIN;
}

export function startTimer(now: number, preset: TimerPreset, target: TimerTarget): Active {
  return {
    status: "active",
    preset: clampPreset(preset),
    target,
    sessionStartedAt: now,
    phase: "focus",
    runStartedAt: now,
    phaseAccruedMs: 0,
    focusDoneMs: 0,
    phaseComplete: false,
  };
}

// Time spent in the current phase, capped at its planned length.
export function phaseElapsedMs(state: Active, now: number): number {
  const running = state.runStartedAt === null ? 0 : Math.max(0, now - state.runStartedAt);
  return Math.min(plannedMs(state), state.phaseAccruedMs + running);
}

// Freezes a phase that has reached its planned length. Call on every tick and
// on load; it is idempotent.
export function settle(state: TimerState, now: number): TimerState {
  if (state.status !== "active" || state.phaseComplete) return state;
  if (state.runStartedAt === null) return state; // paused: nothing is running
  if (phaseElapsedMs(state, now) < plannedMs(state)) return state;
  return { ...state, runStartedAt: null, phaseAccruedMs: plannedMs(state), phaseComplete: true };
}

export function pause(state: TimerState, now: number): TimerState {
  const settled = settle(state, now);
  if (settled.status !== "active" || settled.phaseComplete || settled.runStartedAt === null) {
    return settled;
  }
  return {
    ...settled,
    phaseAccruedMs: phaseElapsedMs(settled, now),
    runStartedAt: null,
  };
}

export function resume(state: TimerState, now: number): TimerState {
  if (state.status !== "active" || state.phaseComplete || state.runStartedAt !== null) {
    return state;
  }
  return { ...state, runStartedAt: now };
}

// Moves a finished (or skipped) phase on: focus -> break, break -> focus. A
// focus phase that is skipped early banks only the time actually spent.
export function nextPhase(state: TimerState, now: number): TimerState {
  const settled = settle(state, now);
  if (settled.status !== "active") return settled;
  const spent = phaseElapsedMs(settled, now);
  return {
    ...settled,
    phase: settled.phase === "focus" ? "break" : "focus",
    runStartedAt: now,
    phaseAccruedMs: 0,
    focusDoneMs: settled.focusDoneMs + (settled.phase === "focus" ? spent : 0),
    phaseComplete: false,
  };
}

// Total focus time so far in this session.
export function focusTotalMs(state: TimerState, now: number): number {
  if (state.status !== "active") return 0;
  return state.focusDoneMs + (state.phase === "focus" ? phaseElapsedMs(state, now) : 0);
}

export interface FinishedSession {
  startedAt: number;
  durationSeconds: number;
  target: TimerTarget;
}

// Ends the session. Returns null for an idle timer. The duration is whole
// seconds of FOCUS time; whether it is long enough to log is decided by the
// server's limits (lib/study-session.ts), and shown to the student first.
export function finish(state: TimerState, now: number): FinishedSession | null {
  if (state.status !== "active") return null;
  return {
    startedAt: state.sessionStartedAt,
    durationSeconds: Math.floor(focusTotalMs(state, now) / 1000),
    target: state.target,
  };
}

// --- Persistence ------------------------------------------------------------

export const TIMER_STORAGE_KEY = "cherenkov.study-timer.v1";

const isNum = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const isStrOrNull = (value: unknown): value is string | null =>
  value === null || typeof value === "string";

// Reads a stored timer back. Anything malformed, or with timestamps from the
// future (a clock that was wrong when it was saved), becomes "idle" rather
// than a half-valid timer.
export function parseTimerState(raw: unknown, now: number): TimerState {
  const idle: TimerState = { status: "idle" };
  if (!raw || typeof raw !== "object") return idle;
  const r = raw as Record<string, unknown>;
  if (r.status !== "active") return idle;
  const preset = r.preset as Record<string, unknown> | undefined;
  const target = r.target as Record<string, unknown> | undefined;
  if (!preset || !target) return idle;
  if (!isNum(preset.focusMin) || !isNum(preset.breakMin)) return idle;
  if (!isStrOrNull(target.subject) || !isStrOrNull(target.syllabusTopicId) || !isStrOrNull(target.planItemId)) {
    return idle;
  }
  if (r.phase !== "focus" && r.phase !== "break") return idle;
  if (!isNum(r.sessionStartedAt) || !isNum(r.phaseAccruedMs) || !isNum(r.focusDoneMs)) return idle;
  if (r.runStartedAt !== null && !isNum(r.runStartedAt)) return idle;
  if (typeof r.phaseComplete !== "boolean") return idle;
  if (r.phaseAccruedMs < 0 || r.focusDoneMs < 0) return idle;
  const skew = 5 * MIN;
  if (r.sessionStartedAt > now + skew) return idle;
  if (isNum(r.runStartedAt) && r.runStartedAt > now + skew) return idle;

  return settle(
    {
      status: "active",
      preset: clampPreset({ focusMin: preset.focusMin, breakMin: preset.breakMin }),
      target: {
        subject: target.subject,
        syllabusTopicId: target.syllabusTopicId,
        planItemId: target.planItemId,
      },
      sessionStartedAt: r.sessionStartedAt,
      phase: r.phase,
      runStartedAt: r.runStartedAt as number | null,
      phaseAccruedMs: r.phaseAccruedMs,
      focusDoneMs: r.focusDoneMs,
      phaseComplete: r.phaseComplete,
    },
    now,
  );
}

// "mm:ss", or "h:mm:ss" from one hour up.
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
