// "Review my misses" (R2): turns the student's answer history into a list of
// the questions they have got wrong, and whether each one is resolved yet.
// Pure: no database, no clock (callers pass `now`). The real reads live in
// lib/misses-db.ts.
//
// Two sources feed one history per question:
//   - quiz answers (quiz_question_responses), which also feed mastery, and
//   - retries made from the review page (question_retries), which do NOT.
// A miss is RESOLVED when the most recent event for that question — from
// either source — is correct. Nothing is inferred beyond that: no automatic
// "error type" grouping, because quiz questions carry no authored error type.
import type { QuestionDifficulty, QuestionStatus } from "./planner-vocab";
import type { Subject } from "./subjects";

export type AnswerSource = "quiz" | "retry";

export interface AnswerEvent {
  questionId: string;
  correct: boolean;
  // Null for quiz rows written before the column existed.
  selectedChoiceIndex: number | null;
  at: Date;
  source: AnswerSource;
}

export interface MissQuestion {
  questionId: string;
  prompt: string;
  choices: string[];
  correctChoiceIndex: number;
  explanation: string | null;
  difficulty: QuestionDifficulty;
  status: QuestionStatus;
  subject: Subject;
  // Planner `topics` row id, used to group and filter.
  topicId: string;
  // Syllabus topic id (null for legacy editorial-derived topic rows).
  syllabusTopicId: string | null;
}

export interface MissEntry {
  question: MissQuestion;
  resolved: boolean;
  // When the student most recently got it wrong.
  lastMissedAt: Date;
  // Which choice they picked on that wrong answer (null if not recorded).
  lastWrongChoice: number | null;
  wrongCount: number;
  // How many times they have retried it from the review page.
  retryCount: number;
}

// Orders events oldest -> newest. Ties (same timestamp) keep input order, and
// a retry sorts after a quiz answer made at the same instant.
function sortEvents(events: AnswerEvent[]): AnswerEvent[] {
  return events
    .map((event, index) => ({ event, index }))
    .sort(
      (a, b) =>
        a.event.at.getTime() - b.event.at.getTime() ||
        Number(a.event.source === "retry") - Number(b.event.source === "retry") ||
        a.index - b.index,
    )
    .map((entry) => entry.event);
}

export function buildMissEntries(
  events: AnswerEvent[],
  questions: MissQuestion[],
): MissEntry[] {
  const byQuestion = new Map<string, AnswerEvent[]>();
  for (const event of events) {
    const list = byQuestion.get(event.questionId) ?? [];
    list.push(event);
    byQuestion.set(event.questionId, list);
  }

  const entries: MissEntry[] = [];
  for (const question of questions) {
    const history = sortEvents(byQuestion.get(question.questionId) ?? []);
    const wrong = history.filter((event) => !event.correct);
    const lastWrong = wrong[wrong.length - 1];
    if (!lastWrong) continue; // never missed -> not on this page
    entries.push({
      question,
      resolved: history[history.length - 1]!.correct,
      lastMissedAt: lastWrong.at,
      lastWrongChoice: lastWrong.selectedChoiceIndex,
      wrongCount: wrong.length,
      retryCount: history.filter((event) => event.source === "retry").length,
    });
  }

  // Open misses first, then newest miss first; question id keeps it stable.
  return entries.sort(
    (a, b) =>
      Number(a.resolved) - Number(b.resolved) ||
      b.lastMissedAt.getTime() - a.lastMissedAt.getTime() ||
      a.question.questionId.localeCompare(b.question.questionId),
  );
}

export type MissState = "open" | "resolved" | "all";
export type MissRecency = "7d" | "30d" | "all";

export interface MissFilters {
  subject?: Subject;
  // Syllabus topic id (only meaningful together with `subject`).
  topic?: string;
  state?: MissState;
  recency?: MissRecency;
}

const RECENCY_DAYS: Record<Exclude<MissRecency, "all">, number> = { "7d": 7, "30d": 30 };

export function filterMisses(
  entries: MissEntry[],
  filters: MissFilters,
  now: Date,
): MissEntry[] {
  const state = filters.state ?? "open";
  const recency = filters.recency ?? "all";
  const cutoff =
    recency === "all" ? null : now.getTime() - RECENCY_DAYS[recency] * 86_400_000;
  return entries.filter((entry) => {
    if (state === "open" && entry.resolved) return false;
    if (state === "resolved" && !entry.resolved) return false;
    if (filters.subject && entry.question.subject !== filters.subject) return false;
    if (filters.topic && entry.question.syllabusTopicId !== filters.topic) return false;
    if (cutoff !== null && entry.lastMissedAt.getTime() < cutoff) return false;
    return true;
  });
}

const isOneOf = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (values as readonly string[]).includes(value);

// Reads the page's query string defensively: anything unrecognised falls back
// to the default instead of erroring.
export function parseMissFilters(
  raw: Record<string, string | string[] | undefined>,
  subjects: readonly Subject[],
): MissFilters {
  const one = (key: string) => {
    const value = raw[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const subject = one("subject");
  const topic = one("topic");
  const state = one("state");
  const recency = one("recency");
  return {
    subject: isOneOf(subjects, subject) ? subject : undefined,
    topic: topic && /^[a-z0-9-]{1,80}$/i.test(topic) ? topic : undefined,
    state: isOneOf(["open", "resolved", "all"] as const, state) ? state : "open",
    recency: isOneOf(["7d", "30d", "all"] as const, recency) ? recency : "all",
  };
}
