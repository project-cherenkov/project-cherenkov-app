// Gathers everything the planner needs to know about one student: their
// settings, the syllabus topics of their subject, self-ratings, quiz answers,
// and the resulting mastery estimate per topic. Dependency-injected so it is
// testable without a database; the real queries live in lib/plan-db.ts.
// Shared by plan generation (lib/plan-service.ts) and the plan page
// (lib/plan-view.ts), so both always agree on what the student's state is.
import {
  estimateAllTopics,
  type AnswerEvidence,
  type MasteryEstimate,
} from "./mastery";
import {
  STAGES,
  difficultiesForStage,
  getStageWindow,
  todayInTimeZone,
  type StageWindow,
} from "./osn-stages";
import type { PlannerSettings } from "./planner-settings";
import type { QuestionDifficulty } from "./planner-vocab";
import type { SchedulerTopic } from "./plan-scheduler";
import type { Subject } from "./subjects";
import { getTopicLocation } from "./syllabus";

// A planner `topics` row that is keyed to the syllabus.
export interface PlanTopicRow {
  id: string; // topics.id (uuid)
  syllabusTopicId: string;
  sectionId: string | null;
  order: number;
}

export interface AnswerRow {
  topicId: string;
  correct: boolean;
  answeredAt: Date;
}

export interface PlanReadDeps {
  getSettings: (userId: string) => Promise<PlannerSettings | null>;
  // Only rows that have a syllabus_topic_id (legacy editorial-derived rows are
  // not planner topics).
  getSubjectTopics: (subject: Subject) => Promise<PlanTopicRow[]>;
  getSelfRatings: (userId: string, topicIds: string[]) => Promise<Map<string, number>>;
  // Answers to questions whose difficulty is in `difficulties`.
  getAnswers: (
    userId: string,
    topicIds: string[],
    difficulties: QuestionDifficulty[],
  ) => Promise<AnswerRow[]>;
  // Ids (among `topicIds`) that have at least one question in `difficulties`.
  getTopicsWithQuestions: (
    topicIds: string[],
    difficulties: QuestionDifficulty[],
  ) => Promise<Set<string>>;
}

export interface TopicState {
  row: PlanTopicRow;
  sectionId: string;
  effort: 1 | 2 | 3;
  selfRating: number | null;
  answers: AnswerEvidence[];
  canConfirm: boolean;
  estimate: MasteryEstimate;
}

export interface PlanningState {
  settings: PlannerSettings;
  today: string;
  window: StageWindow | null;
  masteryTarget: number;
  topics: TopicState[];
  calibrationOffset: number;
}

// Returns null when the student has no settings yet. `window` is null when no
// dates are published for the chosen stage and year.
export async function loadPlanningState(
  deps: PlanReadDeps,
  userId: string,
  now: Date,
): Promise<PlanningState | null> {
  const settings = await deps.getSettings(userId);
  if (!settings) return null;

  const today = todayInTimeZone(now, settings.timezone);
  const window = getStageWindow(settings.stage, settings.examYear) ?? null;
  const masteryTarget = STAGES[settings.stage].masteryTarget;
  const difficulties = difficultiesForStage(settings.stage);

  const rows = [...(await deps.getSubjectTopics(settings.subject))].sort(
    (a, b) => a.order - b.order || a.id.localeCompare(b.id),
  );
  if (rows.length === 0) {
    return { settings, today, window, masteryTarget, topics: [], calibrationOffset: 0 };
  }
  const ids = rows.map((r) => r.id);

  const [ratings, answerRows, withQuestions] = await Promise.all([
    deps.getSelfRatings(userId, ids),
    deps.getAnswers(userId, ids, difficulties),
    deps.getTopicsWithQuestions(ids, difficulties),
  ]);

  const answersByTopic = new Map<string, AnswerEvidence[]>();
  for (const a of answerRows) {
    const list = answersByTopic.get(a.topicId) ?? [];
    list.push({ correct: a.correct, answeredAt: a.answeredAt });
    answersByTopic.set(a.topicId, list);
  }

  const partial = rows.map((row) => {
    const located = getTopicLocation(settings.subject, row.syllabusTopicId);
    return {
      row,
      sectionId: row.sectionId ?? located?.section.id ?? "unknown",
      effort: (located?.topic.effort ?? 2) as 1 | 2 | 3,
      selfRating: ratings.get(row.id) ?? null,
      answers: answersByTopic.get(row.id) ?? [],
      canConfirm: withQuestions.has(row.id),
    };
  });

  const estimated = estimateAllTopics(
    partial.map((p) => ({ key: p.row.id, selfRating: p.selfRating, answers: p.answers })),
    masteryTarget,
    now,
  );
  const estimateByKey = new Map(estimated.topics.map((t) => [t.key, t.estimate]));

  return {
    settings,
    today,
    window,
    masteryTarget,
    calibrationOffset: estimated.offset,
    topics: partial.map((p) => ({ ...p, estimate: estimateByKey.get(p.row.id)! })),
  };
}

export function toSchedulerTopics(state: PlanningState): SchedulerTopic[] {
  return state.topics.map((t) => ({
    key: t.row.id,
    sectionId: t.sectionId,
    order: t.row.order,
    effort: t.effort,
    selfRating: t.selfRating,
    estimate: t.estimate,
    canConfirm: t.canConfirm,
  }));
}
