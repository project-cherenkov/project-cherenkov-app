// Mastery estimates for the progress page's coverage map. Reuses the planner's
// own reads (PlanReadDeps) and estimator so the map can never disagree with
// the plan about what the student knows. DI'd, so it is testable without a
// database; the real reads are in lib/plan-db.ts (makePlanReadDeps).
import { estimateAllTopics, type MasteryEstimate } from "./mastery";
import { STAGES, difficultiesForStage } from "./osn-stages";
import type { PlanReadDeps } from "./plan-state";
import type { OsnStage } from "./planner-vocab";
import type { Subject } from "./subjects";

export interface SubjectMastery {
  // Keyed by SYLLABUS topic id.
  estimates: Map<string, MasteryEstimate>;
  stage: OsnStage;
}

// `stage` decides which question difficulties count and which mastery target
// "known" is measured against (same as the plan). Pass the student's planner
// stage when they have one.
export async function loadSubjectMastery(
  deps: PlanReadDeps,
  userId: string,
  subject: Subject,
  stage: OsnStage,
  now: Date,
): Promise<SubjectMastery> {
  const difficulties = difficultiesForStage(stage);
  const rows = await deps.getSubjectTopics(subject);
  if (rows.length === 0) return { estimates: new Map(), stage };
  const ids = rows.map((r) => r.id);

  const [ratings, answers] = await Promise.all([
    deps.getSelfRatings(userId, ids),
    deps.getAnswers(userId, ids, difficulties),
  ]);
  const byTopic = new Map<string, { correct: boolean; answeredAt: Date }[]>();
  for (const a of answers) {
    const list = byTopic.get(a.topicId) ?? [];
    list.push({ correct: a.correct, answeredAt: a.answeredAt });
    byTopic.set(a.topicId, list);
  }

  const estimated = estimateAllTopics(
    rows.map((row) => ({
      key: row.id,
      selfRating: ratings.get(row.id) ?? null,
      answers: byTopic.get(row.id) ?? [],
    })),
    STAGES[stage].masteryTarget,
    now,
  );
  const bySyllabusId = new Map<string, MasteryEstimate>();
  const keyToSyllabus = new Map(rows.map((r) => [r.id, r.syllabusTopicId]));
  for (const t of estimated.topics) {
    const syllabusId = keyToSyllabus.get(t.key);
    if (syllabusId) bySyllabusId.set(syllabusId, t.estimate);
  }
  return { estimates: bySyllabusId, stage };
}
