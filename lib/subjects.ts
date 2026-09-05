// Mirrors velite.config.ts's `subjects` tuple and keystatic.config.ts's
// per-collection literals. Duplicated rather than imported from
// velite.config.ts because that file is a build-time Velite config (it's
// only otherwise imported by velite.config.test.ts) — pulling it into
// app runtime code, including client components, risked pulling
// Velite's build-time machinery into the bundle for a three-string list.
// If the real subject list ever changes, update both this file and
// velite.config.ts's `subjects` together (velite.config.test.ts and
// scene-builder-write.test.ts both assert against these values, so a
// mismatch fails the test suite).
export const SUBJECTS = ["informatics", "physics", "astronomy"] as const;

export type Subject = (typeof SUBJECTS)[number];

export function isKnownSubject(value: string): value is Subject {
  return (SUBJECTS as readonly string[]).includes(value);
}
