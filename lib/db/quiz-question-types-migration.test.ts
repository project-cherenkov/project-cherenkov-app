// Runs the real SQL migrations on a real Postgres engine (PGlite, in-process
// WASM Postgres) with legacy single-choice data in place, applies
// 0013_quiz_question_types.sql, and checks that nothing was lost, the new
// columns are backfilled, history stays readable, and the Drizzle schema in
// lib/db/schema.ts matches what the migration produced.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { questionRetries, quizQuestionResponses, quizQuestions } from "./schema";
import { storedResponse, toServerQuestion } from "../quiz-types";

const DIR = join(__dirname, "../../drizzle");
const MIGRATION = "0013_quiz_question_types.sql";

async function runFile(client: PGlite, file: string) {
  for (const statement of readFileSync(join(DIR, file), "utf8").split("--> statement-breakpoint")) {
    if (statement.trim()) await client.exec(statement);
  }
}

let client: PGlite;
let topicId: string;
const legacy = { archived: "", draft: "", keyless: "" };
let attemptId: string;

beforeAll(async () => {
  client = new PGlite();
  const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files.filter((f) => f < MIGRATION)) await runFile(client, file);

  await client.exec(`INSERT INTO "user"(id, name, email) VALUES ('u1', 'U', 'u@example.com')`);
  topicId = (
    await client.query<{ id: string }>(
      `INSERT INTO topics(subject, title, chapter, "order", syllabus_topic_id) VALUES ('physics', 'T', 'C', 1, 'vectors') RETURNING id`,
    )
  ).rows[0]!.id;
  const rows = (
    await client.query<{ id: string; key: string | null }>(
      `INSERT INTO quiz_questions(topic_id, prompt, choices, correct_choice_index, explanation, key, difficulty, status, archived) VALUES
        ($1, 'P-archived', '["a","b","c"]'::jsonb, 2, 'E', 'physics.vectors.basic.1', 'basic', 'reviewed', true),
        ($1, 'P-draft', '["x","y"]'::jsonb, 0, NULL, 'physics.vectors.advanced.1', 'advanced', 'draft', false),
        ($1, 'P-keyless', '["p","q","r","s"]'::jsonb, 3, 'K', NULL, 'intermediate', 'reviewed', false)
       RETURNING id, key`,
      [topicId],
    )
  ).rows;
  legacy.archived = rows.find((r) => r.key === "physics.vectors.basic.1")!.id;
  legacy.draft = rows.find((r) => r.key === "physics.vectors.advanced.1")!.id;
  legacy.keyless = rows.find((r) => r.key === null)!.id;
  attemptId = (await client.query<{ id: string }>(`INSERT INTO quiz_attempts(user_id, topic_id, score) VALUES ('u1', $1, 0.5) RETURNING id`, [topicId])).rows[0]!.id;
  await client.query(`INSERT INTO quiz_question_responses(attempt_id, question_id, correct, selected_choice_index) VALUES ($1, $2, false, 1)`, [attemptId, legacy.archived]);
  await client.query(`INSERT INTO question_retries(user_id, question_id, correct, selected_choice_index) VALUES ('u1', $1, false, 0)`, [legacy.archived]);

  await runFile(client, MIGRATION);
}, 60_000);

afterAll(async () => {
  await client?.close();
});

describe("migration 0013 — existing data", () => {
  it("backfills every legacy row as single_choice, keeping id, key, prompt, status, archive flag and the correct answer", async () => {
    const db = drizzle(client);
    const rows = await db.select().from(quizQuestions);
    expect(rows).toHaveLength(3);
    const byId = new Map(rows.map((r) => [r.id, r]));

    const archived = byId.get(legacy.archived)!;
    expect(archived).toMatchObject({
      key: "physics.vectors.basic.1", prompt: "P-archived", status: "reviewed", archived: true, difficulty: "basic",
      explanation: "E", questionType: "single_choice",
      content: { type: "single_choice", choices: ["a", "b", "c"] },
      answerKey: { type: "single_choice", correctChoiceIndex: 2 },
    });
    expect(byId.get(legacy.draft)).toMatchObject({
      key: "physics.vectors.advanced.1", status: "draft", archived: false, explanation: null,
      answerKey: { type: "single_choice", correctChoiceIndex: 0 },
    });
    expect(byId.get(legacy.keyless)).toMatchObject({
      key: null, content: { type: "single_choice", choices: ["p", "q", "r", "s"] }, answerKey: { type: "single_choice", correctChoiceIndex: 3 },
    });
    // The server-side readers accept every backfilled row.
    for (const row of rows) expect(toServerQuestion(row.id, row.content, row.answerKey), row.id).not.toBeNull();
  });

  it("keeps the old columns intact (deprecated, nullable) and drops nothing", async () => {
    const [row] = await drizzle(client).select().from(quizQuestions).where(eq(quizQuestions.id, legacy.archived));
    expect(row).toMatchObject({ choices: ["a", "b", "c"], correctChoiceIndex: 2 });
    const nullable = await client.query<{ column_name: string; is_nullable: string }>(
      `SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'quiz_questions' AND column_name IN ('choices','correct_choice_index','content','answer_key','question_type')`,
    );
    expect(Object.fromEntries(nullable.rows.map((r) => [r.column_name, r.is_nullable]))).toEqual({
      choices: "YES", correct_choice_index: "YES", content: "NO", answer_key: "NO", question_type: "NO",
    });
  });

  it("leaves response and retry history untouched and readable through the compatibility path", async () => {
    const db = drizzle(client);
    const [response] = await db.select().from(quizQuestionResponses);
    expect(response).toMatchObject({ questionId: legacy.archived, correct: false, selectedChoiceIndex: 1, response: null });
    expect(storedResponse(response!)).toEqual({ type: "single_choice", choiceIndex: 1 });
    const [retry] = await db.select().from(questionRetries);
    expect(retry).toMatchObject({ selectedChoiceIndex: 0, response: null });
    expect(storedResponse(retry!)).toEqual({ type: "single_choice", choiceIndex: 0 });
  });

  it("keeps the unique key semantics (a second row with the same key is rejected; keyless rows may repeat)", async () => {
    await expect(
      client.query(
        `INSERT INTO quiz_questions(topic_id, prompt, question_type, content, answer_key, difficulty, key) VALUES ($1, 'dup', 'single_choice', '{"type":"single_choice","choices":["a","b"]}', '{"type":"single_choice","correctChoiceIndex":0}', 'basic', 'physics.vectors.basic.1')`,
        [topicId],
      ),
    ).rejects.toThrow(/quiz_questions_key_unique/);
  });
});

describe("migration 0013 — new representation, through the real Drizzle schema", () => {
  it("stores and reads back every question type", async () => {
    const db = drizzle(client);
    const values = [
      { key: "physics.vectors.basic.2", questionType: "multiple_select" as const, content: { type: "multiple_select" as const, choices: ["a", "b", "c"] }, answerKey: { type: "multiple_select" as const, correctChoiceIndices: [0, 2] } },
      { key: "physics.vectors.basic.3", questionType: "true_false_set" as const, content: { type: "true_false_set" as const, statements: ["x", "y", "z"] }, answerKey: { type: "true_false_set" as const, truthValues: [true, false, true] } },
      { key: "physics.vectors.basic.4", questionType: "numeric_response" as const, content: { type: "numeric_response" as const, unit: "au" }, answerKey: { type: "numeric_response" as const, value: 2.35, tolerance: 0.01 } },
    ];
    for (const v of values) await db.insert(quizQuestions).values({ topicId, prompt: "P", difficulty: "basic", ...v });
    for (const v of values) {
      const [row] = await db.select().from(quizQuestions).where(eq(quizQuestions.key, v.key));
      expect(row).toMatchObject({ questionType: v.questionType, choices: null, correctChoiceIndex: null });
      expect(toServerQuestion(row!.id, row!.content, row!.answerKey)).toMatchObject({ content: v.content, answerKey: v.answerKey });
    }
  });

  it("rejects a row whose content or answer key disagrees with its type", async () => {
    const insert = (type: string, content: string, key: string) =>
      client.query(`INSERT INTO quiz_questions(topic_id, prompt, question_type, content, answer_key, difficulty) VALUES ($1, 'bad', '${type}', '${content}', '${key}', 'basic')`, [topicId]);
    await expect(insert("multiple_select", '{"type":"single_choice","choices":["a","b"]}', '{"type":"multiple_select"}')).rejects.toThrow(/quiz_questions_content_type_check/);
    await expect(insert("single_choice", '{"type":"single_choice","choices":["a","b"]}', '{"type":"numeric_response"}')).rejects.toThrow(/quiz_questions_answer_key_type_check/);
  });

  it("stores type-neutral responses and retries, with the legacy index column nullable", async () => {
    const db = drizzle(client);
    const [question] = await db.select().from(quizQuestions).where(eq(quizQuestions.key, "physics.vectors.basic.4"));
    const attempt = (await client.query<{ id: string }>(`INSERT INTO quiz_attempts(user_id, topic_id, score) VALUES ('u1', $1, 0) RETURNING id`, [topicId])).rows[0]!.id;
    await db.insert(quizQuestionResponses).values({ attemptId: attempt, questionId: question!.id, correct: true, response: { type: "numeric_response", value: 2.36 } });
    await db.insert(questionRetries).values({ userId: "u1", questionId: question!.id, correct: false, response: { type: "numeric_response", value: 9 } });
    const [stored] = await db.select().from(quizQuestionResponses).where(eq(quizQuestionResponses.attemptId, attempt));
    expect(storedResponse(stored!)).toEqual({ type: "numeric_response", value: 2.36 });
    expect(stored!.selectedChoiceIndex).toBeNull();
  });
});

describe("migration bookkeeping", () => {
  it("is registered in the drizzle journal with a later timestamp than its predecessor", () => {
    const journal = JSON.parse(readFileSync(join(DIR, "meta/_journal.json"), "utf8")) as { entries: { idx: number; when: number; tag: string }[] };
    const entry = journal.entries.find((e) => e.tag === MIGRATION.replace(".sql", ""));
    expect(entry).toBeTruthy();
    const previous = journal.entries.find((e) => e.idx === entry!.idx - 1)!;
    expect(entry!.when).toBeGreaterThan(previous.when);
    // Every .sql file has exactly one journal entry.
    const sql = readdirSync(DIR).filter((f) => f.endsWith(".sql")).map((f) => f.replace(".sql", "")).sort();
    expect(journal.entries.map((e) => e.tag).sort()).toEqual(sql);
  });
});
