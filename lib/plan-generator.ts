export interface PlanTopic {
  id: string;
  order: number;
}

export interface GeneratedPlanItem {
  topicId: string;
  scheduledFor: string; // "YYYY-MM-DD"
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(startIso: string, endIso: string): number {
  const start = new Date(`${startIso}T00:00:00Z`).getTime();
  const end = new Date(`${endIso}T00:00:00Z`).getTime();
  return Math.round((end - start) / 86_400_000);
}

// PLANNER-002, Plan generation Option A (predetermined). Pure and
// deterministic: the same (topics, targetExamDate, today) always produces
// the same output (spec §8 determinism test) — no randomness, no reliance
// on wall-clock time beyond the explicit `today` parameter.
//
// Boundary case (spec §6, §8 compression test): if the window between
// `today` and `targetExamDate` is shorter than the topic count — including
// `targetExamDate` being today or in the past — every topic is still
// scheduled, compressed onto however many days actually exist. The window
// is clamped to at least 1 day so this never divides by zero or throws.
//
// Distribution: topic i (0-indexed, after sorting by `order`) is assigned
// day index floor(i * windowDays / topicCount), which spreads topics evenly
// across the window when windowDays >= topicCount, and compresses multiple
// topics onto the same day when windowDays < topicCount — the same formula
// handles both cases without a branch.
export function generatePlanItems(
  topics: PlanTopic[],
  targetExamDate: string,
  today: string,
): GeneratedPlanItem[] {
  const ordered = [...topics].sort((a, b) => a.order - b.order);
  const n = ordered.length;
  if (n === 0) return [];

  const rawWindow = daysBetween(today, targetExamDate) + 1; // inclusive of exam day
  const windowDays = Math.max(1, rawWindow);

  return ordered.map((topic, i) => {
    const dayIndex = Math.min(windowDays - 1, Math.floor((i * windowDays) / n));
    return { topicId: topic.id, scheduledFor: addDays(today, dayIndex) };
  });
}

// ---------------------------------------------------------------------------
// Generate/regenerate orchestration, dependency-injected for testability
// (same pattern as lib/quiz-scoring.ts's submitQuizAttemptCore) — lets §8's
// regeneration test run against an in-memory fake instead of a live
// database.
// ---------------------------------------------------------------------------

export interface ExistingPlanRef {
  id: string;
}

export interface PlanGenerationDeps {
  getAllTopics: () => Promise<PlanTopic[]>;
  getExistingPlan: (userId: string) => Promise<ExistingPlanRef | null>;
  insertPlan: (userId: string, targetExamDate: string) => Promise<string>;
  updatePlan: (planId: string, targetExamDate: string) => Promise<void>;
  deletePlanItems: (planId: string) => Promise<void>;
  insertPlanItems: (
    planId: string,
    items: GeneratedPlanItem[],
  ) => Promise<void>;
}

export type GeneratePlanCoreResult =
  | { ok: true; planId: string; itemCount: number }
  | { ok: false; reason: "no_topics" };

// Decision #7: one always-current plan per user. Regenerating updates the
// existing study_plans row and replaces its plan_items wholesale — it never
// inserts a second study_plans row for the same user (studyPlans.userId is
// also DB-unique — see lib/db/schema.ts — so this is enforced at two
// layers, not just here).
export async function generateOrRegeneratePlanCore(
  deps: PlanGenerationDeps,
  userId: string,
  targetExamDate: string,
  today: string,
): Promise<GeneratePlanCoreResult> {
  const allTopics = await deps.getAllTopics();
  if (allTopics.length === 0) {
    return { ok: false, reason: "no_topics" };
  }

  const items = generatePlanItems(allTopics, targetExamDate, today);
  const existing = await deps.getExistingPlan(userId);

  const planId = existing
    ? existing.id
    : await deps.insertPlan(userId, targetExamDate);

  if (existing) {
    await deps.updatePlan(planId, targetExamDate);
    await deps.deletePlanItems(planId);
  }

  await deps.insertPlanItems(planId, items);

  return { ok: true, planId, itemCount: items.length };
}
