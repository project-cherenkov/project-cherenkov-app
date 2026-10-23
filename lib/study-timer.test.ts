import { describe, expect, it } from "vitest";

import {
  finish,
  focusTotalMs,
  formatClock,
  nextPhase,
  parseTimerState,
  pause,
  phaseElapsedMs,
  resume,
  settle,
  startTimer,
  clampPreset,
  type TimerState,
} from "./study-timer";

const MIN = 60_000;
const T0 = Date.UTC(2026, 9, 20, 8, 0, 0);
const target = { subject: "physics", syllabusTopicId: "vectors", planItemId: null };
const preset = { focusMin: 25, breakMin: 5 };

function active(state: TimerState) {
  if (state.status !== "active") throw new Error("expected active timer");
  return state;
}

describe("elapsed time comes from timestamps", () => {
  it("counts wall-clock time while running, however rarely it is polled", () => {
    const s = startTimer(T0, preset, target);
    expect(phaseElapsedMs(s, T0 + 10 * MIN)).toBe(10 * MIN);
    expect(phaseElapsedMs(s, T0 + 10 * MIN + 1)).toBe(10 * MIN + 1);
  });

  it("stops counting while paused and carries on after resume", () => {
    let s: TimerState = startTimer(T0, preset, target);
    s = pause(s, T0 + 10 * MIN);
    expect(phaseElapsedMs(active(s), T0 + 60 * MIN)).toBe(10 * MIN);
    s = resume(s, T0 + 60 * MIN);
    expect(phaseElapsedMs(active(s), T0 + 65 * MIN)).toBe(15 * MIN);
  });

  it("never goes negative when the clock moves backwards", () => {
    const s = startTimer(T0, preset, target);
    expect(phaseElapsedMs(s, T0 - 5 * MIN)).toBe(0);
  });
});

describe("a phase is never credited past its planned length", () => {
  it("freezes at the planned length after a long sleep", () => {
    const s = settle(startTimer(T0, preset, target), T0 + 5 * 60 * MIN);
    const a = active(s);
    expect(a.phaseComplete).toBe(true);
    expect(a.runStartedAt).toBeNull();
    expect(focusTotalMs(a, T0 + 5 * 60 * MIN)).toBe(25 * MIN);
  });

  it("does not chain into the next block on its own", () => {
    const later = T0 + 10 * 60 * MIN;
    const s = settle(startTimer(T0, preset, target), later);
    expect(active(s).phase).toBe("focus");
    expect(finish(s, later)!.durationSeconds).toBe(25 * 60);
  });

  it("settle is idempotent", () => {
    const once = settle(startTimer(T0, preset, target), T0 + 40 * MIN);
    expect(settle(once, T0 + 90 * MIN)).toEqual(once);
  });

  it("a finished phase cannot be paused or resumed", () => {
    const done = settle(startTimer(T0, preset, target), T0 + 30 * MIN);
    expect(pause(done, T0 + 31 * MIN)).toEqual(done);
    expect(resume(done, T0 + 31 * MIN)).toEqual(done);
  });
});

describe("phases", () => {
  it("moves focus -> break -> focus and banks focus time only", () => {
    let s: TimerState = startTimer(T0, preset, target);
    s = nextPhase(s, T0 + 25 * MIN); // focus complete -> break
    expect(active(s).phase).toBe("break");
    expect(focusTotalMs(s, T0 + 28 * MIN)).toBe(25 * MIN); // break time not counted
    s = nextPhase(s, T0 + 30 * MIN); // break over -> second focus
    expect(active(s).phase).toBe("focus");
    expect(focusTotalMs(s, T0 + 40 * MIN)).toBe(35 * MIN);
  });

  it("banks only the time actually spent when a focus block is cut short", () => {
    let s: TimerState = startTimer(T0, preset, target);
    s = nextPhase(s, T0 + 10 * MIN);
    expect(active(s).focusDoneMs).toBe(10 * MIN);
  });

  it("a break that runs over is capped and credits no study time", () => {
    let s: TimerState = startTimer(T0, preset, target);
    s = nextPhase(s, T0 + 25 * MIN);
    s = settle(s, T0 + 600 * MIN);
    expect(focusTotalMs(s, T0 + 600 * MIN)).toBe(25 * MIN);
  });
});

describe("finish", () => {
  it("returns null when idle", () => {
    expect(finish({ status: "idle" }, T0)).toBeNull();
  });

  it("reports the session start, whole focus seconds and the target", () => {
    const s = startTimer(T0, preset, target);
    expect(finish(s, T0 + 12 * MIN + 999)).toEqual({
      startedAt: T0,
      durationSeconds: 12 * 60,
      target,
    });
  });
});

describe("presets", () => {
  it("clamps editable presets into sane bounds", () => {
    expect(clampPreset({ focusMin: 0, breakMin: 999 })).toEqual({ focusMin: 1, breakMin: 60 });
    expect(clampPreset({ focusMin: 5000, breakMin: -3 })).toEqual({ focusMin: 180, breakMin: 1 });
    expect(clampPreset({ focusMin: Number.NaN, breakMin: 4.6 })).toEqual({ focusMin: 1, breakMin: 5 });
  });
});

describe("parseTimerState (untrusted storage)", () => {
  it("round-trips a valid state through JSON", () => {
    const s = pause(startTimer(T0, preset, target), T0 + 5 * MIN);
    const back = parseTimerState(JSON.parse(JSON.stringify(s)), T0 + 6 * MIN);
    expect(back).toEqual(s);
  });

  it("treats junk as idle", () => {
    for (const raw of [null, 42, "x", {}, { status: "active" }, { status: "active", preset: {}, target: {} }]) {
      expect(parseTimerState(raw, T0)).toEqual({ status: "idle" });
    }
  });

  it("rejects negative time and timestamps from the future", () => {
    const good = JSON.parse(JSON.stringify(startTimer(T0, preset, target)));
    expect(parseTimerState({ ...good, phaseAccruedMs: -1 }, T0)).toEqual({ status: "idle" });
    expect(parseTimerState({ ...good, sessionStartedAt: T0 + 60 * MIN }, T0)).toEqual({ status: "idle" });
    expect(parseTimerState({ ...good, phase: "nap" }, T0)).toEqual({ status: "idle" });
  });

  it("settles a stored running timer that expired while the tab was closed", () => {
    const stored = JSON.parse(JSON.stringify(startTimer(T0, preset, target)));
    const back = parseTimerState(stored, T0 + 8 * 60 * MIN);
    expect(active(back).phaseComplete).toBe(true);
    expect(focusTotalMs(back, T0 + 8 * 60 * MIN)).toBe(25 * MIN);
  });

  it("clamps an out-of-range stored preset", () => {
    const stored = JSON.parse(JSON.stringify(startTimer(T0, preset, target)));
    stored.preset = { focusMin: 99999, breakMin: 5 };
    expect(active(parseTimerState(stored, T0)).preset.focusMin).toBe(180);
  });
});

describe("formatClock", () => {
  it("formats minutes:seconds and hours", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(65_000)).toBe("01:05");
    expect(formatClock(3_725_000)).toBe("1:02:05");
    expect(formatClock(-5)).toBe("00:00");
  });
});
