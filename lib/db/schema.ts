import {
  pgTable,
  pgEnum,
  text,
  boolean,
  timestamp,
  uuid,
  integer,
  jsonb,
  numeric,
  date,
} from "drizzle-orm/pg-core";

// ===========================================================================
// Better Auth core tables — user, session, account, verification
// ===========================================================================
//
// DEVIATION / UNVERIFIED (decision #11, spec §9 MEDIUM risk, AUTH-001's
// explicit first implementation requirement):
//
// The spec requires running Better Auth's own schema generator against the
// actually-installed `better-auth` version (`npx @better-auth/cli generate`,
// pointed at this file) BEFORE hand-writing these four tables, specifically
// so an assumed shape doesn't silently diverge from what the installed
// version really produces — the same class of bug keystatic.config.ts's own
// DEVIATION comments already document for this repo (a `fields.conditional()`
// serialization shape that didn't match assumed docs).
//
// That generator could not be run in this environment: no network access,
// so `pnpm install` itself fails (registry returns 403) and there is no
// `node_modules` to run the CLI from. This mirrors the exact gap the spec's
// own risk table already anticipated ("no network access when this spec was
// written") — it just recurred one step later, for the worker instead of the
// architect. Per the spec's own required mitigation, the four tables below
// are hand-written from Better Auth's documented, stable default Drizzle
// Postgres adapter shape for the 1.x line (core config only: email/password
// + one social provider, no additional plugins), NOT verified against the
// installed version.
//
// BEFORE DEPLOYING: run
//   npx @better-auth/cli generate --config lib/auth.ts
// against a real DATABASE_URL and diff the result against this file. If it
// differs, update this file and log what changed here, in this same
// DEVIATION-comment style — don't silently drift.
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  // Better Auth's Google adapter populates this regardless of what the app
  // asks for. Decision #2 (data minimisation) means Cherenkov's own UI never
  // reads or displays it — see components/auth/* — but the column itself is
  // part of Better Auth's generated core schema, not something this app gets
  // to omit.
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  // Set for the email/password provider; null for OAuth-only accounts.
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ===========================================================================
// Phase 2 app tables — DB-002 (topics, quiz_questions), QUIZ-001
// (quiz_attempts), PLANNER-002 (study_plans, plan_items)
// ===========================================================================

// DB-002 implementation requirement: must match velite.config.ts's
// `subjects` enum exactly — informatics / physics / astronomy — so this
// never drifts into a second, independently-typed subject vocabulary. If
// velite.config.ts's subjects tuple ever changes, this must change with it.
export const subjectEnum = pgEnum("subject", [
  "informatics",
  "physics",
  "astronomy",
]);

export const topics = pgTable("topics", {
  id: uuid("id").primaryKey().defaultRandom(),
  subject: subjectEnum("subject").notNull(),
  chapter: text("chapter").notNull(),
  title: text("title").notNull(),
  order: integer("order").notNull(),
  // Deep-links into /archive/<subject>/<slug> (lib/content.ts's
  // getEditorial) — deliberately does NOT duplicate editorial content
  // (spec §4). Nullable: a planner topic can exist before its editorial is
  // published.
  editorialSlug: text("editorial_slug"),
});

export const quizQuestions = pgTable("quiz_questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  topicId: uuid("topic_id")
    .notNull()
    .references(() => topics.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  choices: jsonb("choices").$type<string[]>().notNull(),
  // Server-side only — lib/quiz-actions.ts is the only module allowed to
  // select this column, and it must never reach the client before
  // submission (spec §5, §9 HIGH risk, QUIZ-001 constraint).
  correctChoiceIndex: integer("correct_choice_index").notNull(),
  explanation: text("explanation"),
});

export const quizAttempts = pgTable("quiz_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  topicId: uuid("topic_id")
    .notNull()
    .references(() => topics.id, { onDelete: "cascade" }),
  // Fraction correct, 0..1 (spec §5's data model). Stored as a real number
  // (not a numeric-as-string) since nothing here needs arbitrary precision —
  // scores are always n/m for small integer n, m.
  score: numeric("score", { precision: 4, scale: 3, mode: "number" }).notNull(),
  attemptedAt: timestamp("attempted_at").notNull().defaultNow(),
});

export const studyPlans = pgTable("study_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  // One always-current plan per user (decision #7) — UNIQUE enforces that
  // invariant at the database level, not only in application code.
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  // Date-only, no time-of-day component (decision #9 — sidesteps timezone
  // handling for a feature that only needs day granularity). mode: "string"
  // keeps this as a plain "YYYY-MM-DD" string end to end.
  targetExamDate: date("target_exam_date", { mode: "string" }).notNull(),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
});

export const planItems = pgTable("plan_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  planId: uuid("plan_id")
    .notNull()
    .references(() => studyPlans.id, { onDelete: "cascade" }),
  topicId: uuid("topic_id")
    .notNull()
    .references(() => topics.id, { onDelete: "cascade" }),
  scheduledFor: date("scheduled_for", { mode: "string" }).notNull(),
  // Set automatically when the linked topic's derived status becomes `done`
  // (decision #8) — see lib/quiz-actions.ts's post-submission hook. No other
  // code path writes to this column; there is deliberately no manual
  // "mark complete" action anywhere in Phase 2.
  completedAt: timestamp("completed_at"),
});
