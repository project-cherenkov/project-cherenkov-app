import { describe, expect, it } from "vitest";

import {
  buildMissEntries,
  filterMisses,
  parseMissFilters,
  type AnswerEvent,
  type MissQuestion,
} from "./misses";

const q = (id: string, over: Partial<MissQuestion> = {}): MissQuestion => ({
  questionId: id,
  prompt: `prompt ${id}`,
  choices: ["a", "b", "c"],
  correctChoiceIndex: 1,
  explanation: null,
  difficulty: "basic",
  status: "draft",
  subject: "physics",
  topicId: `topic-${id}`,
  syllabusTopicId: `syl-${id}`,
  ...over,
});

const ev = (
  questionId: string,
  correct: boolean,
  day: number,
  over: Partial<AnswerEvent> = {},
): AnswerEvent => ({
  questionId,
  correct,
  selectedChoiceIndex: correct ? 1 : 0,
  at: new Date(Date.UTC(2026, 9, day)),
  source: "quiz",
  ...over,
});

describe("buildMissEntries", () => {
  it("lists only questions that were missed at least once", () => {
    const entries = buildMissEntries(
      [ev("a", true, 1), ev("b", false, 1)],
      [q("a"), q("b"), q("c")],
    );
    expect(entries.map((e) => e.question.questionId)).toEqual(["b"]);
  });

  it("is resolved only when the latest event is correct", () => {
    const [entry] = buildMissEntries([ev("a", false, 1), ev("a", true, 2)], [q("a")]);
    expect(entry!.resolved).toBe(true);

    const [again] = buildMissEntries(
      [ev("a", false, 1), ev("a", true, 2), ev("a", false, 3)],
      [q("a")],
    );
    expect(again!.resolved).toBe(false);
    expect(again!.wrongCount).toBe(2);
  });

  it("lets a retry resolve a miss and counts retries", () => {
    const [entry] = buildMissEntries(
      [ev("a", false, 1), ev("a", true, 2, { source: "retry" })],
      [q("a")],
    );
    expect(entry!.resolved).toBe(true);
    expect(entry!.retryCount).toBe(1);
  });

  it("does not depend on the order events arrive in", () => {
    const events = [ev("a", true, 3), ev("a", false, 1)];
    expect(buildMissEntries(events, [q("a")])[0]!.resolved).toBe(true);
    expect(buildMissEntries([...events].reverse(), [q("a")])[0]!.resolved).toBe(true);
  });

  it("on identical timestamps a retry counts as later than the quiz answer", () => {
    const [entry] = buildMissEntries(
      [ev("a", true, 2, { source: "retry" }), ev("a", false, 2)],
      [q("a")],
    );
    expect(entry!.resolved).toBe(true);
  });

  it("reports the choice picked on the most recent wrong answer, or null if unrecorded", () => {
    const [entry] = buildMissEntries(
      [
        ev("a", false, 1, { selectedChoiceIndex: 2 }),
        ev("a", false, 2, { selectedChoiceIndex: null }),
      ],
      [q("a")],
    );
    expect(entry!.lastWrongChoice).toBeNull();
  });

  it("puts open misses before resolved ones, newest first", () => {
    const entries = buildMissEntries(
      [
        ev("old-open", false, 1),
        ev("new-open", false, 5),
        ev("resolved", false, 9),
        ev("resolved", true, 10),
      ],
      [q("old-open"), q("new-open"), q("resolved")],
    );
    expect(entries.map((e) => e.question.questionId)).toEqual([
      "new-open",
      "old-open",
      "resolved",
    ]);
  });

  it("ignores events for questions it has no record of", () => {
    expect(buildMissEntries([ev("ghost", false, 1)], [q("a")])).toEqual([]);
  });
});

describe("filterMisses", () => {
  const now = new Date(Date.UTC(2026, 9, 20));
  const entries = buildMissEntries(
    [
      ev("p1", false, 19),
      ev("p2", false, 1),
      ev("a1", false, 18, { }),
      ev("done", false, 15),
      ev("done", true, 16),
    ],
    [
      q("p1"),
      q("p2"),
      q("a1", { subject: "astronomy" }),
      q("done"),
    ],
  );

  it("defaults to open misses", () => {
    expect(filterMisses(entries, {}, now).map((e) => e.question.questionId).sort()).toEqual([
      "a1",
      "p1",
      "p2",
    ]);
  });

  it("filters by state", () => {
    expect(filterMisses(entries, { state: "resolved" }, now)).toHaveLength(1);
    expect(filterMisses(entries, { state: "all" }, now)).toHaveLength(4);
  });

  it("filters by subject and by syllabus topic", () => {
    expect(
      filterMisses(entries, { subject: "astronomy" }, now).map((e) => e.question.questionId),
    ).toEqual(["a1"]);
    expect(
      filterMisses(entries, { subject: "physics", topic: "syl-p2" }, now).map(
        (e) => e.question.questionId,
      ),
    ).toEqual(["p2"]);
  });

  it("filters by recency of the last miss", () => {
    const ids = filterMisses(entries, { recency: "7d" }, now).map((e) => e.question.questionId);
    expect(ids).not.toContain("p2");
    expect(ids).toContain("p1");
  });
});

describe("parseMissFilters", () => {
  const subjects = ["informatics", "physics", "astronomy"] as const;

  it("falls back to safe defaults for junk input", () => {
    expect(
      parseMissFilters(
        { subject: "chemistry", state: "weird", recency: "1y", topic: "../../etc" },
        subjects,
      ),
    ).toEqual({ subject: undefined, topic: undefined, state: "open", recency: "all" });
  });

  it("accepts valid values and takes the first of repeated params", () => {
    expect(
      parseMissFilters(
        { subject: ["physics", "astronomy"], topic: "vectors", state: "all", recency: "30d" },
        subjects,
      ),
    ).toEqual({ subject: "physics", topic: "vectors", state: "all", recency: "30d" });
  });
});
