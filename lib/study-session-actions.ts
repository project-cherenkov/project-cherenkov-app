"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth-guard";
import { getAllEditorials, getAllMaterials } from "@/lib/content";
import {
  deleteOwnedSession,
  isUnderstood,
  setUnderstood,
  studySessionDeps,
} from "@/lib/study-session-db";
import {
  logStudySessionCore,
  type LogSessionResult,
  type StudySessionInput,
} from "@/lib/study-session";
import { parseUnderstoodTarget } from "@/lib/understood";

export type LogStudySessionResult = LogSessionResult | { ok: false; reason: "unauthenticated" };

// The user always comes from the server-side session; the browser's timer is
// only a suggestion and is re-validated in lib/study-session.ts.
export async function logStudySession(input: StudySessionInput): Promise<LogStudySessionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "unauthenticated" };
  const result = await logStudySessionCore(
    studySessionDeps,
    user.id,
    {
      startedAtMs: input?.startedAtMs,
      durationSeconds: input?.durationSeconds,
      source: input?.source,
      subject: input?.subject ?? null,
      syllabusTopicId: input?.syllabusTopicId ?? null,
      planItemId: input?.planItemId ?? null,
    },
    Date.now(),
  );
  if (result.ok) revalidatePath("/[locale]/planner/progress", "page");
  return result;
}

export async function deleteStudySession(
  sessionId: string,
): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  const ok = await deleteOwnedSession(user.id, String(sessionId));
  if (ok) revalidatePath("/[locale]/planner/progress", "page");
  return { ok };
}

const lookup = {
  hasMaterial: (subject: string, slug: string) =>
    getAllMaterials().some((m) => m.subject === subject && m.slug === slug),
  hasEditorial: (subject: string, slug: string) =>
    getAllEditorials().some((e) => e.subject === subject && e.slug === slug),
};

export type UnderstoodResult =
  | { ok: true; understood: boolean }
  | { ok: false; reason: "unauthenticated" | "invalid" };

export async function getUnderstood(input: {
  kind: "material" | "editorial";
  subject: string;
  slug: string;
}): Promise<UnderstoodResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "unauthenticated" };
  const target = parseUnderstoodTarget(input, lookup);
  if (!target) return { ok: false, reason: "invalid" };
  return {
    ok: true,
    understood: await isUnderstood(user.id, target.kind, target.subject, target.slug),
  };
}

export async function setUnderstoodMark(input: {
  kind: "material" | "editorial";
  subject: string;
  slug: string;
  understood: boolean;
}): Promise<UnderstoodResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "unauthenticated" };
  const target = parseUnderstoodTarget(input, lookup);
  if (!target) return { ok: false, reason: "invalid" };
  const understood = input.understood === true;
  await setUnderstood(user.id, target.kind, target.subject, target.slug, understood);
  revalidatePath("/[locale]/planner/progress", "page");
  return { ok: true, understood };
}
