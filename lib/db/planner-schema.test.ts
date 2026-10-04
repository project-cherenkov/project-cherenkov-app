import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  OSN_STAGES,
  PLAN_ITEM_KINDS,
  QUESTION_DIFFICULTIES,
  QUESTION_STATUSES,
} from "../planner-vocab";
import {
  osnStageEnum,
  planItemKindEnum,
  planItems,
  questionDifficultyEnum,
  questionStatusEnum,
  quizQuestionResponses,
  quizQuestions,
  topicSelfRatings,
  topics,
  userPlannerSettings,
} from "./schema";

type Table = Parameters<typeof getTableConfig>[0];

const column = (table: Table, name: string) => {
  const c = getTableConfig(table).columns.find((col) => col.name === name);
  if (!c) throw new Error(`no such column: ${name}`);
  return c;
};
const indexes = (table: Table) =>
  getTableConfig(table).indexes.map((i) => [i.config.name, i.config.unique] as const);
const checks = (table: Table) => getTableConfig(table).checks.map((c) => c.name);

describe("Phase 3 planner schema", () => {
  it("builds its enums from the shared vocabulary", () => {
    expect(osnStageEnum.enumValues).toEqual([...OSN_STAGES]);
    expect(questionDifficultyEnum.enumValues).toEqual([...QUESTION_DIFFICULTIES]);
    expect(questionStatusEnum.enumValues).toEqual([...QUESTION_STATUSES]);
    expect(planItemKindEnum.enumValues).toEqual([...PLAN_ITEM_KINDS]);
  });

  it("requires a difficulty on every quiz question and defaults status to draft", () => {
    expect(column(quizQuestions, "difficulty").notNull).toBe(true);
    expect(column(quizQuestions, "difficulty").hasDefault).toBe(false);
    expect(column(quizQuestions, "status").default).toBe("draft");
    expect(indexes(quizQuestions)).toContainEqual(["quiz_questions_key_unique", true]);
  });

  it("keys topics by (subject, syllabus topic id) and keeps the id nullable for legacy rows", () => {
    expect(column(topics, "syllabus_topic_id").notNull).toBe(false);
    expect(indexes(topics)).toContainEqual(["topics_subject_syllabus_topic_unique", true]);
  });

  it("gives plan_items a kind (default study) and an optional reason", () => {
    expect(column(planItems, "kind").default).toBe("study");
    expect(column(planItems, "kind").notNull).toBe(true);
    expect(column(planItems, "reason").notNull).toBe(false);
  });

  it("records one response per (attempt, question)", () => {
    expect(indexes(quizQuestionResponses)).toContainEqual([
      "quiz_question_responses_attempt_question_unique",
      true,
    ]);
    expect(column(quizQuestionResponses, "correct").notNull).toBe(true);
  });

  it("keeps one settings row per user, with bounds checks and no stored exam date", () => {
    expect(column(userPlannerSettings, "user_id").primary).toBe(true);
    expect(checks(userPlannerSettings)).toEqual(
      expect.arrayContaining([
        "user_planner_settings_hours_check",
        "user_planner_settings_exam_year_check",
      ]),
    );
    expect(column(userPlannerSettings, "timezone").default).toBe("Asia/Jakarta");
    expect(getTableConfig(userPlannerSettings).columns.map((c) => c.name)).not.toContain("exam_date");
  });

  it("keeps one self-rating per (user, topic), bounded by a check", () => {
    expect(getTableConfig(topicSelfRatings).primaryKeys).toHaveLength(1);
    expect(checks(topicSelfRatings)).toContain("topic_self_ratings_rating_check");
  });
});
