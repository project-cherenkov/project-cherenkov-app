import { describe, expect, it } from "vitest";

import type { MasteryEstimate } from "./mastery";
import {
  ACTIVE_DAY_MIN_MINUTES,
  buildCoverage,
  minutesByDay,
  minutesByTopic,
  weeklyActivity,
  type SessionLike,
} from "./progress";
import type { SubjectSyllabus } from "./syllabus";

const TZ = "Asia/Jakarta"; // UTC+7
// 2026-10-20 is a Tuesday. Week: Mon 10-19 .. Sun 10-25.
const TODAY = "2026-10-20";

const session = (iso: string, minutes: number, over: Partial<SessionLike> = {}): SessionLike => ({
  subject: null,
  syllabusTopicId: null,
  startedAt: new Date(iso),
  durationSeconds: minutes * 60,
  ...over,
});

describe("weeklyActivity", () => {
  it("covers Monday to Sunday of the current week", () => {
    const w = weeklyActivity(TODAY, [], [], TZ);
    expect(w.weekStart).toBe("2026-10-19");
    expect(w.days.map((d) => d.date)).toEqual([
      "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25",
    ]);
    expect(w.activeDays).toBe(0);
  });

  it("counts a day only from real study: enough minutes, or a quiz attempt", () => {
    const w = weeklyActivity(
      TODAY,
      [
        session("2026-10-19T03:00:00Z", ACTIVE_DAY_MIN_MINUTES), // Mon, exactly the minimum
        session("2026-10-20T03:00:00Z", ACTIVE_DAY_MIN_MINUTES - 1), // Tue, too short alone
      ],
      [new Date("2026-10-21T03:00:00Z")], // Wed, quiz attempt only
      TZ,
    );
    expect(w.days.map((d) => d.active)).toEqual([true, false, true, false, false, false, false]);
    expect(w.activeDays).toBe(2);
  });

  it("adds several short sessions on one day together", () => {
    const w = weeklyActivity(
      TODAY,
      [session("2026-10-20T01:00:00Z", 6), session("2026-10-20T05:00:00Z", 6)],
      [],
      TZ,
    );
    expect(w.days[1]!.active).toBe(true);
    expect(w.days[1]!.minutes).toBe(12);
  });

  it("assigns sessions to the student's own calendar day, not UTC's", () => {
    // 2026-10-19T18:00Z is already Tue 01:00 in Jakarta.
    const w = weeklyActivity(TODAY, [session("2026-10-19T18:00:00Z", 30)], [], TZ);
    expect(w.days[0]!.minutes).toBe(0);
    expect(w.days[1]!.minutes).toBe(30);
  });

  it("ignores activity from other weeks", () => {
    const w = weeklyActivity(TODAY, [session("2026-10-12T03:00:00Z", 60)], [], TZ);
    expect(w.totalMinutes).toBe(0);
  });
});

describe("minutesByDay", () => {
  it("returns a zero-filled window ending today", () => {
    const rows = minutesByDay(TODAY, [session("2026-10-20T03:00:00Z", 45)], TZ, 7);
    expect(rows).toHaveLength(7);
    expect(rows[0]!.date).toBe("2026-10-14");
    expect(rows[6]).toEqual({ date: "2026-10-20", minutes: 45 });
    expect(rows.slice(0, 6).every((r) => r.minutes === 0)).toBe(true);
  });
});

describe("minutesByTopic", () => {
  it("sums per (subject, topic), pools topic-less sessions, and sorts largest first", () => {
    const rows = minutesByTopic([
      session("2026-10-20T03:00:00Z", 20, { subject: "physics", syllabusTopicId: "vectors" }),
      session("2026-10-20T05:00:00Z", 25, { subject: "physics", syllabusTopicId: "vectors" }),
      session("2026-10-20T06:00:00Z", 30),
      session("2026-10-20T07:00:00Z", 10, { subject: "informatics", syllabusTopicId: "vectors" }),
    ]);
    expect(rows).toEqual([
      { subject: "physics", syllabusTopicId: "vectors", minutes: 45 },
      { subject: null, syllabusTopicId: null, minutes: 30 },
      { subject: "informatics", syllabusTopicId: "vectors", minutes: 10 },
    ]);
  });

  it("respects the limit", () => {
    const sessions = ["a", "b", "c"].map((id, i) =>
      session("2026-10-20T03:00:00Z", 10 + i, { subject: "physics", syllabusTopicId: id }),
    );
    expect(minutesByTopic(sessions, 2)).toHaveLength(2);
  });
});

describe("buildCoverage", () => {
  const syllabus = {
    subject: "informatics",
    sourceLang: "en",
    source: { label: "test" },
    sections: [
      {
        id: "s1",
        name: { en: "S1", id: "S1" },
        part: "theory",
        topics: [
          { id: "t1", name: { en: "T1", id: "T1" } },
          { id: "t2", name: { en: "T2", id: "T2" } },
          { id: "t3", name: { en: "T3", id: "T3" } },
        ],
      },
      { id: "practical", name: { en: "P", id: "P" }, part: "practical", topics: [], note: "n" },
    ],
  } as SubjectSyllabus;

  const est = (over: Partial<MasteryEstimate>): MasteryEstimate => ({
    status: "known",
    alpha: 5,
    beta: 2,
    pHat: 0.7,
    pLower: 0.5,
    pUpper: 0.9,
    answerCount: 4,
    effectiveAnswers: 3.5,
    ...over,
  });

  it("keeps 'not enough data' distinct from 'not known' and hides prior guesses", () => {
    const cov = buildCoverage(
      syllabus,
      new Map([
        ["t1", est({ status: "unverified", pHat: 0.55, pLower: 0.2, pUpper: 0.9, answerCount: 0 })],
        ["t2", est({ status: "not_known", pHat: 0.3, pLower: 0.1, pUpper: 0.5, answerCount: 3 })],
      ]),
      new Map(),
      new Set(),
    );
    const [t1, t2, t3] = cov.sections[0]!.cells;
    expect(t1).toMatchObject({ status: "unverified", pHat: null, pLower: null, pUpper: null, answerCount: 0 });
    expect(t2).toMatchObject({ status: "not_known", pHat: 0.3, pLower: 0.1, pUpper: 0.5, answerCount: 3 });
    // no estimate at all -> also "not enough data", never "weak"
    expect(t3!.status).toBe("unverified");
    expect(cov.counts).toEqual({ unverified: 2, known: 0, uncertain: 0, not_known: 1 });
  });

  it("skips sections with no linkable topics", () => {
    expect(buildCoverage(syllabus, new Map(), new Map(), new Set()).sections).toHaveLength(1);
  });

  it("flags understood materials separately from mastery", () => {
    const cov = buildCoverage(
      syllabus,
      new Map([["t1", est({})]]),
      new Map([["t1", "mat-1"], ["t2", "mat-2"]]),
      new Set(["mat-2"]),
    );
    const [t1, t2] = cov.sections[0]!.cells;
    expect(t1).toMatchObject({ status: "known", understood: false, materialSlug: "mat-1" });
    // understood, but mastery is untouched
    expect(t2).toMatchObject({ status: "unverified", understood: true });
    expect(cov.understoodCount).toBe(1);
    expect(cov.topicCount).toBe(3);
  });
});
