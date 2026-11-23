import { describe, expect, it } from "vitest";
import { quizQuestions, topics } from "../db/schema";
import { syncQuizBank, type SeedDb } from "./seed-db";
import type { BankQuestion } from "../quiz-bank/types";

// A tiny stand-in for the slice of Drizzle that syncQuizBank uses. Each query
// builder is awaitable, like Drizzle's. The planning rules are tested in
// lib/quiz-bank/sync.test.ts; this only proves the statements are issued.
function fakeDb(state: {
  topicRows: unknown[];
  questionRows: unknown[];
  keyless?: number;
}) {
  const log = { inserted: [] as unknown[], updates: [] as unknown[] };
  const rowsFor = (table: unknown) => (table === topics ? state.topicRows : state.questionRows);
  const db = {
    select: (shape?: Record<string, unknown>) => ({
      from: (table: unknown) => {
        // countKeylessQuestions selects a single aggregate.
        if (shape && "n" in shape) {
          return { where: async () => [{ n: state.keyless ?? 0 }] };
        }
        const rows = rowsFor(table);
        return Object.assign(Promise.resolve(rows), { where: async () => rows });
      },
    }),
    insert: () => ({
      values: (values: unknown) => {
        log.inserted.push(...(values as unknown[]));
        return { onConflictDoNothing: async () => [] };
      },
    }),
    update: (table: unknown) => ({
      set: (set: unknown) => ({
        where: async () => {
          expect(table).toBe(quizQuestions);
          log.updates.push(set);
          return [];
        },
      }),
    }),
  };
  return { db: db as unknown as SeedDb, log };
}

const q: BankQuestion = {
  key: "informatics.binary-search.basic.1", subject: "informatics", topicId: "binary-search",
  difficulty: "basic", prompt: "Prompt", choices: ["A", "B"], correctChoiceIndex: 0,
  explanation: "Because", status: "draft", archived: false,
};
const topicRows = [{ id: "topic-row", subject: "informatics", syllabusTopicId: "binary-search" }];
const existingRow = {
  id: "row-1", key: q.key, topicId: "topic-row", prompt: "Prompt", choices: ["A", "B"],
  correctChoiceIndex: 0, explanation: "Because", difficulty: "basic", status: "draft", archived: false,
};

describe("syncQuizBank", () => {
  it("inserts a missing question", async () => {
    const { db, log } = fakeDb({ topicRows, questionRows: [] });
    const report = await syncQuizBank(db, [q]);
    expect(report).toMatchObject({ inserted: 1, updated: 0, unchanged: 0 });
    expect(log.inserted).toHaveLength(1);
  });

  it("is a no-op when nothing changed", async () => {
    const { db, log } = fakeDb({ topicRows, questionRows: [existingRow] });
    const report = await syncQuizBank(db, [q]);
    expect(report).toMatchObject({ inserted: 0, updated: 0, unchanged: 1 });
    expect(log.inserted).toEqual([]);
    expect(log.updates).toEqual([]);
  });

  it("overwrites database content from git, and archives (not deletes) a missing question", async () => {
    const gone = { ...existingRow, id: "row-2", key: "informatics.binary-search.basic.2" };
    const { db, log } = fakeDb({ topicRows, questionRows: [{ ...existingRow, prompt: "Edited" }, gone] });
    const report = await syncQuizBank(db, [q]);
    expect(report).toMatchObject({ updated: 1, archivedMissing: ["informatics.binary-search.basic.2"] });
    expect(log.updates).toEqual([{ prompt: "Prompt" }, { archived: true }]);
  });

  it("counts rows it does not manage", async () => {
    const { db } = fakeDb({
      topicRows,
      questionRows: [existingRow, { ...existingRow, id: "x", key: "admin.abc" }],
      keyless: 2,
    });
    expect((await syncQuizBank(db, [q])).unmanaged).toBe(3);
  });

  it("refuses an empty bank instead of archiving everything", async () => {
    const { db, log } = fakeDb({ topicRows, questionRows: [existingRow] });
    await expect(syncQuizBank(db, [])).rejects.toThrow(/empty quiz bank/);
    expect(log.updates).toEqual([]);
  });
});
