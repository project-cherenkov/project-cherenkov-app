// Logging a finished study session (R3). DI'd like lib/quiz-scoring.ts so the
// rules are testable without a database; the real queries are in
// lib/study-session-db.ts and the "use server" wrapper is
// lib/study-session-actions.ts.
//
// The server does not trust the browser's timer: it re-checks everything.
//  - duration: at least a minute, at most 12 hours;
//  - start: not in the future (small clock-skew allowance) and not more than a
//    year ago (manual entries);
//  - topic: must be a real syllabus topic of the stated subject;
//  - plan item: must belong to this user;
//  - overlap: a session may not overlap another session of the same user.
//    There is no server-side "open timer" (the timer lives in the browser and
//    only a FINISHED session is sent), so this rule is what stops two devices
//    from logging the same hour twice.
// Study minutes are never fed into the mastery estimate.
import { isKnownSubject, type Subject } from "./subjects";
import { getTopicLocation } from "./syllabus";

export const SESSION_LIMITS = {
  minSeconds: 60,
  maxSeconds: 12 * 3600,
  maxFutureSkewMs: 5 * 60_000,
  maxPastMs: 366 * 86_400_000,
} as const;

export type SessionSource = "timer" | "manual";

export interface StudySessionInput {
  startedAtMs: number;
  durationSeconds: number;
  source: SessionSource;
  subject?: string | null;
  syllabusTopicId?: string | null;
  planItemId?: string | null;
}

export interface ValidSession {
  startedAt: Date;
  durationSeconds: number;
  source: SessionSource;
  subject: Subject | null;
  syllabusTopicId: string | null;
  planItemId: string | null;
}

export type SessionRejection =
  | "invalid"
  | "too_short"
  | "too_long"
  | "in_future"
  | "too_old"
  | "invalid_topic"
  | "invalid_plan_item"
  | "overlap";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateSession(
  input: StudySessionInput,
  nowMs: number,
): { ok: true; value: ValidSession } | { ok: false; reason: SessionRejection } {
  if (
    !input ||
    !Number.isFinite(input.startedAtMs) ||
    !Number.isInteger(input.durationSeconds) ||
    (input.source !== "timer" && input.source !== "manual")
  ) {
    return { ok: false, reason: "invalid" };
  }
  if (input.durationSeconds < SESSION_LIMITS.minSeconds) return { ok: false, reason: "too_short" };
  if (input.durationSeconds > SESSION_LIMITS.maxSeconds) return { ok: false, reason: "too_long" };

  const endMs = input.startedAtMs + input.durationSeconds * 1000;
  // A session is "in the future" if it started in the future or has not
  // finished yet (the end may exceed `now` only by the skew allowance).
  if (
    input.startedAtMs > nowMs + SESSION_LIMITS.maxFutureSkewMs ||
    endMs > nowMs + SESSION_LIMITS.maxFutureSkewMs
  ) {
    return { ok: false, reason: "in_future" };
  }
  if (input.startedAtMs < nowMs - SESSION_LIMITS.maxPastMs) return { ok: false, reason: "too_old" };

  let subject: Subject | null = null;
  let syllabusTopicId: string | null = null;
  if (input.syllabusTopicId || input.subject) {
    if (!input.subject || !isKnownSubject(input.subject)) {
      return { ok: false, reason: "invalid_topic" };
    }
    subject = input.subject;
    if (input.syllabusTopicId) {
      if (!getTopicLocation(subject, input.syllabusTopicId)) {
        return { ok: false, reason: "invalid_topic" };
      }
      syllabusTopicId = input.syllabusTopicId;
    }
  }

  let planItemId: string | null = null;
  if (input.planItemId) {
    if (!UUID_RE.test(input.planItemId)) return { ok: false, reason: "invalid_plan_item" };
    planItemId = input.planItemId;
  }

  return {
    ok: true,
    value: {
      startedAt: new Date(input.startedAtMs),
      durationSeconds: input.durationSeconds,
      source: input.source,
      subject,
      syllabusTopicId,
      planItemId,
    },
  };
}

export interface StudySessionDeps {
  ownsPlanItem: (userId: string, planItemId: string) => Promise<boolean>;
  hasOverlap: (userId: string, startedAt: Date, endsAt: Date) => Promise<boolean>;
  insertSession: (row: ValidSession & { userId: string }) => Promise<string>;
}

export type LogSessionResult =
  | { ok: true; id: string }
  | { ok: false; reason: SessionRejection };

export async function logStudySessionCore(
  deps: StudySessionDeps,
  userId: string,
  input: StudySessionInput,
  nowMs: number,
): Promise<LogSessionResult> {
  const checked = validateSession(input, nowMs);
  if (!checked.ok) return checked;
  const session = checked.value;

  if (session.planItemId && !(await deps.ownsPlanItem(userId, session.planItemId))) {
    return { ok: false, reason: "invalid_plan_item" };
  }
  const endsAt = new Date(session.startedAt.getTime() + session.durationSeconds * 1000);
  if (await deps.hasOverlap(userId, session.startedAt, endsAt)) {
    return { ok: false, reason: "overlap" };
  }
  const id = await deps.insertSession({ ...session, userId });
  return { ok: true, id };
}
