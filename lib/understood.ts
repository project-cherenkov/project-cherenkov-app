// "Understood" marks (R4): validation shared by the server action and tests.
// Pure. A mark is only accepted for a page that really exists, so the table
// cannot fill with arbitrary strings.
import { isKnownSubject, type Subject } from "./subjects";

export type UnderstoodKind = "material" | "editorial";

export interface UnderstoodTarget {
  kind: UnderstoodKind;
  subject: Subject;
  slug: string;
}

export interface UnderstoodLookup {
  hasMaterial: (subject: string, slug: string) => boolean;
  hasEditorial: (subject: string, slug: string) => boolean;
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,120}$/;

export function parseUnderstoodTarget(
  input: { kind?: unknown; subject?: unknown; slug?: unknown } | null | undefined,
  lookup: UnderstoodLookup,
): UnderstoodTarget | null {
  if (!input) return null;
  const { kind, subject, slug } = input;
  if (kind !== "material" && kind !== "editorial") return null;
  if (typeof subject !== "string" || !isKnownSubject(subject)) return null;
  if (typeof slug !== "string" || !SLUG_RE.test(slug)) return null;
  const exists =
    kind === "material" ? lookup.hasMaterial(subject, slug) : lookup.hasEditorial(subject, slug);
  return exists ? { kind, subject, slug } : null;
}
