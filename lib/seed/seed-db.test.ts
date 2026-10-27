import { describe, expect, it } from "vitest";
import { seedQuizBank, type SeedDb } from "./seed-db";
import type { BankQuestion } from "../quiz-bank/types";

function fakeDb() {
  const rowByKey = new Map<string, Record<string, unknown>>();
  const db = {
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => [{ id: "topic-row" }] }) }),
    }),
    insert: () => ({
      values: (values: Record<string, unknown>) => ({
        onConflictDoNothing: () => ({
          returning: async () => {
            if (rowByKey.has(String(values.key))) return [];
            rowByKey.set(String(values.key), values);
            return [{ id: "inserted" }];
          },
        }),
      }),
    }),
  };
  return { db: db as unknown as SeedDb, rowByKey };
}

const bank: BankQuestion[] = [{
  key: "informatics.binary-search.basic.1", subject: "informatics", topicId: "binary-search",
  difficulty: "basic", prompt: "Original prompt", choices: ["A", "B"], correctChoiceIndex: 0,
  explanation: "Original explanation", status: "draft",
}];

describe("seedQuizBank", () => {
  it("adds missing rows but leaves database edits untouched on later seeds", async () => {
    const { db, rowByKey } = fakeDb();
    expect(await seedQuizBank(db, bank)).toMatchObject({ upserted: 1 });
    rowByKey.get(bank[0]!.key)!.prompt = "Admin-edited prompt";
    expect(await seedQuizBank(db, bank)).toMatchObject({ upserted: 0 });
    expect(rowByKey.get(bank[0]!.key)!.prompt).toBe("Admin-edited prompt");
  });
});
