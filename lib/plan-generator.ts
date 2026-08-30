export interface PlanTopic {
  id: string;
  subject: "informatics" | "physics" | "astronomy";
  order: number;
}

const SUBJECT_ORDER: Record<PlanTopic["subject"], number> = {
  informatics: 0,
  physics: 1,
  astronomy: 2,
};

function comparePlanTopics(a: PlanTopic, b: PlanTopic): number {
  const subjectDiff = SUBJECT_ORDER[a.subject] - SUBJECT_ORDER[b.subject];
  if (subjectDiff !== 0) return subjectDiff;
  const orderDiff = a.order - b.order;
  if (orderDiff !== 0) return orderDiff;
  return a.id.localeCompare(b.id);
}

export interface GeneratedPlanItem {
  topicId: string;
  scheduledFor: string; // "YYYY-MM-DD"
}

function parseLocalDate(isoDate: string): Date {
  const parts = isoDate.split("-");
  if (parts.length !== 3) {
    return new Date(NaN);
  }

  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  return new Date(year, month - 1, day);
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(isoDate: string, days: number): string {
  const d = parseLocalDate(isoDate);
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
}

function daysBetween(startIso: string, endIso: string): number {
  const start = parseLocalDate(startIso).getTime();
  const end = parseLocalDate(endIso).getTime();
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
  const ordered = [...topics].sort(comparePlanTopics);
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

export interface PlanGenerationTxDeps {
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

export interface PlanGenerationDeps extends PlanGenerationTxDeps {
  transaction?: <T>(
    callback: (tx: PlanGenerationTxDeps) => Promise<T>,
  ) => Promise<T>;
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
  if (deps.transaction) {
    return deps.transaction(async (txDeps) =>
      generateOrRegeneratePlanCore(
        { ...txDeps, transaction: undefined },
        userId,
        targetExamDate,
        today,
      ),
    );
  }

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
