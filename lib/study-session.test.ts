import { describe, expect, it, vi } from "vitest";

import {
  SESSION_LIMITS,
  logStudySessionCore,
  validateSession,
  type StudySessionDeps,
  type StudySessionInput,
} from "./study-session";

const NOW = Date.UTC(2026, 9, 20, 12, 0, 0);
const MIN = 60_000;
const base = (over: Partial<StudySessionInput> = {}): StudySessionInput => ({
  startedAtMs: NOW - 60 * MIN,
  durationSeconds: 30 * 60,
  source: "timer",
  ...over,
});

describe("validateSession", () => {
  it("accepts an ordinary finished session without a topic", () => {
    const r = validateSession(base(), NOW);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toMatchObject({ subject: null, syllabusTopicId: null, planItemId: null });
  });

  it("enforces the duration bounds", () => {
    expect(validateSession(base({ durationSeconds: 59 }), NOW)).toEqual({ ok: false, reason: "too_short" });
    expect(validateSession(base({ durationSeconds: 0 }), NOW)).toEqual({ ok: false, reason: "too_short" });
    expect(validateSession(base({ durationSeconds: -10 }), NOW)).toEqual({ ok: false, reason: "too_short" });
    expect(
      validateSession(base({ startedAtMs: NOW - 20 * 3600_000, durationSeconds: SESSION_LIMITS.maxSeconds + 1 }), NOW),
    ).toEqual({ ok: false, reason: "too_long" });
    expect(validateSession(base({ durationSeconds: 60 }), NOW).ok).toBe(true);
  });

  it("rejects non-integer or non-finite numbers", () => {
    expect(validateSession(base({ durationSeconds: 90.5 }), NOW)).toEqual({ ok: false, reason: "invalid" });
    expect(validateSession(base({ startedAtMs: Number.NaN }), NOW)).toEqual({ ok: false, reason: "invalid" });
    expect(validateSession(base({ source: "bot" as never }), NOW)).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects sessions that start or end in the future, allowing small clock skew", () => {
    expect(validateSession(base({ startedAtMs: NOW + 10 * MIN }), NOW)).toEqual({ ok: false, reason: "in_future" });
    // started 10 min ago but claims 60 min: it would end 50 minutes from now
    expect(
      validateSession(base({ startedAtMs: NOW - 10 * MIN, durationSeconds: 3600 }), NOW),
    ).toEqual({ ok: false, reason: "in_future" });
    // ends 2 minutes from now: inside the skew allowance
    expect(
      validateSession(base({ startedAtMs: NOW - 28 * MIN, durationSeconds: 30 * 60 }), NOW).ok,
    ).toBe(true);
  });

  it("rejects sessions older than a year", () => {
    expect(
      validateSession(base({ startedAtMs: NOW - SESSION_LIMITS.maxPastMs - MIN }), NOW),
    ).toEqual({ ok: false, reason: "too_old" });
  });

  it("checks the syllabus topic against the stated subject", () => {
    expect(validateSession(base({ subject: "informatics", syllabusTopicId: "binary-search" }), NOW).ok).toBe(true);
    expect(validateSession(base({ subject: "physics", syllabusTopicId: "binary-search" }), NOW)).toEqual({
      ok: false,
      reason: "invalid_topic",
    });
    expect(validateSession(base({ subject: "chemistry", syllabusTopicId: "x" }), NOW)).toEqual({
      ok: false,
      reason: "invalid_topic",
    });
    // a topic without a subject is meaningless
    expect(validateSession(base({ syllabusTopicId: "binary-search" }), NOW)).toEqual({
      ok: false,
      reason: "invalid_topic",
    });
  });

  it("allows a subject without a topic", () => {
    const r = validateSession(base({ subject: "astronomy" }), NOW);
    expect(r.ok && r.value.subject).toBe("astronomy");
  });

  it("rejects a malformed plan item id", () => {
    expect(validateSession(base({ planItemId: "'; drop table" }), NOW)).toEqual({
      ok: false,
      reason: "invalid_plan_item",
    });
  });
});

describe("logStudySessionCore", () => {
  const ITEM = "22222222-2222-4222-8222-222222222222";
  function makeDeps(over: Partial<StudySessionDeps> = {}) {
    const deps: StudySessionDeps = {
      ownsPlanItem: vi.fn().mockResolvedValue(true),
      hasOverlap: vi.fn().mockResolvedValue(false),
      insertSession: vi.fn().mockResolvedValue("session-1"),
      ...over,
    };
    return deps;
  }

  it("stores a valid session for the given user", async () => {
    const deps = makeDeps();
    const result = await logStudySessionCore(deps, "u1", base(), NOW);
    expect(result).toEqual({ ok: true, id: "session-1" });
    expect(deps.insertSession).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", durationSeconds: 1800, source: "timer" }),
    );
  });

  it("never touches the database for an invalid session", async () => {
    const deps = makeDeps();
    expect(await logStudySessionCore(deps, "u1", base({ durationSeconds: 5 }), NOW)).toEqual({
      ok: false,
      reason: "too_short",
    });
    expect(deps.hasOverlap).not.toHaveBeenCalled();
    expect(deps.insertSession).not.toHaveBeenCalled();
  });

  it("rejects a plan item the user does not own", async () => {
    const deps = makeDeps({ ownsPlanItem: vi.fn().mockResolvedValue(false) });
    const result = await logStudySessionCore(deps, "u1", base({ planItemId: ITEM }), NOW);
    expect(result).toEqual({ ok: false, reason: "invalid_plan_item" });
    expect(deps.insertSession).not.toHaveBeenCalled();
  });

  it("rejects a session that overlaps an existing one", async () => {
    const deps = makeDeps({ hasOverlap: vi.fn().mockResolvedValue(true) });
    const result = await logStudySessionCore(deps, "u1", base(), NOW);
    expect(result).toEqual({ ok: false, reason: "overlap" });
    expect(deps.insertSession).not.toHaveBeenCalled();
  });

  it("asks for overlap over the session's exact interval", async () => {
    const deps = makeDeps();
    await logStudySessionCore(deps, "u1", base(), NOW);
    const [, start, end] = (deps.hasOverlap as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect((end as Date).getTime() - (start as Date).getTime()).toBe(30 * 60 * 1000);
  });
});
