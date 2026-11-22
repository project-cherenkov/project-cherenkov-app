import {
  pgTable,
  pgEnum,
  text,
  boolean,
  timestamp,
  uuid,
  integer,
  bigint,
  jsonb,
  numeric,
  date,
  smallint,
  uniqueIndex,
  index,
  check,
  primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  MAX_HOURS_PER_WEEK,
  OSN_STAGES,
  PLAN_ITEM_KINDS,
  type PlanSummary,
  QUESTION_DIFFICULTIES,
  QUESTION_STATUSES,
  SELF_RATING_MAX,
  SELF_RATING_MIN,
} from "../planner-vocab";

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
//
// UPDATE (T-07, F-06/F-10 remediation): the generator above WAS run against
// the actually-installed better-auth@1.4.22 (`BETTER_AUTH_SECRET=... npx
// @better-auth/cli generate --config lib/auth.ts -y`) and diffed against
// this file. The hand-written version above was missing:
//   - session.userId / account.userId / verification.identifier: no index
//     (Better Auth's own adapter queries all three without one)
//   - user.updatedAt / session.updatedAt / account.updatedAt: no
//     `.$onUpdate(() => new Date())`
//   - verification.createdAt / verification.updatedAt: nullable instead of
//     `.notNull()`
// All four are now fixed below to match the generator's real output
// exactly; see drizzle/ for the generated migration.
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
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
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
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// Better Auth rate-limit counters (rateLimit.storage = "database" in
// lib/auth-rate-limit.ts). Shape taken from the installed better-auth@1.4.22
// get-tables output: key (unique), count, lastRequest as a bigint of epoch
// milliseconds. The table must exist BEFORE the code that uses it is deployed:
// see drizzle/0010_auth_rate_limit.sql and lib/auth-rate-limit.ts.
export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
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
  // Phase 3: the planner schedules SYLLABUS topics (lib/syllabus). A topic id
  // is only unique within its subject, so the key is (subject,
  // syllabus_topic_id). Nullable because rows created before Phase 3 were
  // derived from editorials and have no syllabus link; the planner must
  // ignore rows where this is null. Postgres treats NULLs as distinct, so
  // many legacy rows can coexist under the unique index below.
  syllabusTopicId: text("syllabus_topic_id"),
  sectionId: text("section_id"),
}, (table) => [
  uniqueIndex("topics_editorial_slug_unique")
    .on(table.editorialSlug)
    .where(sql`${table.editorialSlug} is not null`),
  uniqueIndex("topics_subject_syllabus_topic_unique").on(
    table.subject,
    table.syllabusTopicId,
  ),
]);

// Phase 3 enums (values live in lib/planner-vocab.ts).
export const osnStageEnum = pgEnum("osn_stage", OSN_STAGES);
export const questionDifficultyEnum = pgEnum(
  "question_difficulty",
  QUESTION_DIFFICULTIES,
);
export const questionStatusEnum = pgEnum("question_status", QUESTION_STATUSES);
export const planItemKindEnum = pgEnum("plan_item_kind", PLAN_ITEM_KINDS);

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
  // Phase 3. Stable authoring key from lib/quiz-bank (e.g.
  // "physics.vectors.basic.1") so re-running the seed updates a question
  // instead of duplicating it. Null only for questions created before the
  // bank existed.
  key: text("key"),
  // Every question carries a difficulty label (OSN stages draw from
  // different difficulty ranges). Rows that predate the column were
  // backfilled with `intermediate` WITHOUT review — see the migration.
  difficulty: questionDifficultyEnum("difficulty").notNull(),
  // Unreviewed questions stay `draft` so the app can label them.
  status: questionStatusEnum("status").notNull().default("draft"),
  // Archived questions stay linked to their response history but are not served.
  archived: boolean("archived").notNull().default(false),
}, (table) => [
  uniqueIndex("quiz_questions_key_unique")
    .on(table.key)
    .where(sql`${table.key} is not null`),
]);

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
  // Phase 3: how the plan was generated (feasibility, shortfall, dropped
  // topics). Null for plans made by the Phase 2 even-spread generator.
  summary: jsonb("summary").$type<PlanSummary>(),
});

export const planItems = pgTable(
  "plan_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => studyPlans.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    scheduledFor: date("scheduled_for", { mode: "string" }).notNull(),
    // Phase 2: set automatically when the linked topic's derived status
    // becomes `done` (decision #8, lib/quiz-actions.ts's post-submission
    // hook). Phase 3 adds two more writers: a quiz attempt completes the
    // topic's open confirmation item, and the student can tick a study or
    // review session off by hand (lib/planner-actions.ts, completePlanItem) —
    // reading and revising have no automatic signal.
    completedAt: timestamp("completed_at"),
    // Phase 3: why the item is on the plan (confirmation quiz, first study,
    // review, final review, buffer) and a short human-readable explanation
    // shown next to it. Pre-Phase-3 rows are all first-study items.
    kind: planItemKindEnum("kind").notNull().default("study"),
    reason: text("reason"),
    // Phase 3: planned minutes, and the item's order within its day (after
    // interleaving). Null minutes / position 0 on Phase 2 rows.
    minutes: integer("minutes"),
    position: integer("position").notNull().default(0),
  },
  (table) => [
    index("plan_items_plan_scheduled_idx").on(table.planId, table.scheduledFor),
  ],
);

// ===========================================================================
// Phase 3 planner tables (OSN path)
// ===========================================================================

// Per-question record of every quiz answer. quiz_attempts only keeps an
// aggregate score, which is too coarse to estimate mastery per topic or to
// weigh questions by difficulty; this table keeps one row per answered
// question. Difficulty is deliberately NOT copied here: editors will relabel
// draft questions during review, and estimates should follow the corrected
// label, so it is read through the question.
//
// lib/quiz-scoring.ts (submitQuizAttemptCore) writes one row per answered
// question, in the same transaction as the attempt. (An older version of this
// comment said nothing wrote here yet; that stopped being true when the
// submission path was wired up.)
//
// `selectedChoiceIndex` records WHICH choice the student picked, so the
// misses-review page (R2) can show "your answer" next to the correct one.
// Nullable because rows written before the column existed never recorded it.
export const quizQuestionResponses = pgTable(
  "quiz_question_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => quizAttempts.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => quizQuestions.id, { onDelete: "cascade" }),
    correct: boolean("correct").notNull(),
    selectedChoiceIndex: smallint("selected_choice_index"),
    answeredAt: timestamp("answered_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("quiz_question_responses_attempt_question_unique").on(
      table.attemptId,
      table.questionId,
    ),
    index("quiz_question_responses_question_idx").on(table.questionId),
  ],
);

// One row per user: what the plan is for. One subject per plan (OSN entry is
// per field), and — because study_plans is one-plan-per-user — one subject at
// a time; switching subject replaces the plan. The exam date is not stored:
// it is resolved from (stage, examYear) via lib/osn-stages.ts so a corrected
// official date reaches every plan.
export const userPlannerSettings = pgTable(
  "user_planner_settings",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    subject: subjectEnum("subject").notNull(),
    stage: osnStageEnum("stage").notNull(),
    examYear: integer("exam_year").notNull(),
    // One number for every week (a per-weekday schedule can be added later
    // as a separate column without changing this one).
    hoursPerWeek: numeric("hours_per_week", {
      precision: 4,
      scale: 1,
      mode: "number",
    }).notNull(),
    // IANA zone name; validated in application code (Intl), not in SQL.
    timezone: text("timezone").notNull().default("Asia/Jakarta"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check(
      "user_planner_settings_hours_check",
      sql`${table.hoursPerWeek} > 0 and ${table.hoursPerWeek} <= ${sql.raw(String(MAX_HOURS_PER_WEEK))}`,
    ),
    check(
      "user_planner_settings_exam_year_check",
      sql`${table.examYear} between 2000 and 2100`,
    ),
  ],
);

// The student's own rating of a topic, before any quiz. A weak signal only
// (self-assessment is poorly calibrated), kept so it can be shown next to the
// quiz result. Latest rating per (user, topic); no history.
export const topicSelfRatings = pgTable(
  "topic_self_ratings",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    rating: smallint("rating").notNull(),
    ratedAt: timestamp("rated_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.topicId] }),
    check(
      "topic_self_ratings_rating_check",
      sql`${table.rating} between ${sql.raw(String(SELF_RATING_MIN))} and ${sql.raw(String(SELF_RATING_MAX))}`,
    ),
  ],
);

// ===========================================================================
// Phase 4 study-tool tables (misses review, study timer, progress views)
// ===========================================================================

// A retry of a question the student previously answered wrongly, made from
// the misses-review page. Kept apart from quiz_attempts / quiz_question_responses
// ON PURPOSE: those feed the mastery estimate and the plan's completion
// signals (lib/plan-db.ts reads quiz_question_responses; lib/planner.ts derives
// topic status from quiz_attempts.score). A single-question retry recorded as
// an attempt would score 1/N for the topic and could flip a finished topic
// back to "in progress". Retries are practice, not evidence.
export const questionRetries = pgTable(
  "question_retries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => quizQuestions.id, { onDelete: "cascade" }),
    correct: boolean("correct").notNull(),
    selectedChoiceIndex: smallint("selected_choice_index").notNull(),
    answeredAt: timestamp("answered_at").notNull().defaultNow(),
  },
  (table) => [
    index("question_retries_user_question_idx").on(table.userId, table.questionId),
  ],
);

// One row per finished study session (timer or manual entry). Minutes studied
// are NOT mastery and nothing here feeds lib/mastery.ts. `subject` is stored
// next to `syllabusTopicId` because a syllabus topic id is only unique within
// its subject (see the topics table). `planItemId` is SET NULL on delete since
// regenerating a plan deletes its open items.
export const studySessions = pgTable(
  "study_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    subject: subjectEnum("subject"),
    syllabusTopicId: text("syllabus_topic_id"),
    planItemId: uuid("plan_item_id").references(() => planItems.id, {
      onDelete: "set null",
    }),
    startedAt: timestamp("started_at").notNull(),
    durationSeconds: integer("duration_seconds").notNull(),
    source: text("source").notNull(),
  },
  (table) => [
    index("study_sessions_user_started_idx").on(table.userId, table.startedAt),
    check("study_sessions_duration_check", sql`${table.durationSeconds} > 0`),
    check("study_sessions_source_check", sql`${table.source} in ('timer', 'manual')`),
    check(
      "study_sessions_topic_pair_check",
      sql`(${table.syllabusTopicId} is null) or (${table.subject} is not null)`,
    ),
  ],
);

// Per-account preferences for the Neutrino study companion.
// size / rotation are plain text constrained by CHECKs (not pgEnums) so a new
// option is a one-line migration; the allowed values live in
// lib/companion-settings.ts and the CHECKs must stay in sync with them.
export const companionSettings = pgTable(
  "companion_settings",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull().default("Neutrino"),
    enabled: boolean("enabled").notNull().default(true),
    // Off = the AI chat is hidden and refused by the server; the companion,
    // its FAQ and its timer stay.
    aiEnabled: boolean("ai_enabled").notNull().default(true),
    aiAcknowledged: boolean("ai_acknowledged").notNull().default(false),
    updatesEnabled: boolean("updates_enabled").notNull().default(true),
    size: text("size").notNull().default("medium"),
    rotation: text("rotation").notNull().default("auto"),
    // "pixel" (default) or "smooth" (the original look). Keep the CHECK in
    // sync with COMPANION_STYLES.
    style: text("style").notNull().default("pixel"),
    aiBannerDismissed: boolean("ai_banner_dismissed").notNull().default(false),
    faqBannerDismissed: boolean("faq_banner_dismissed").notNull().default(false),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    check("companion_settings_size_check", sql`${table.size} IN ('small', 'medium', 'large')`),
    check("companion_settings_rotation_check", sql`${table.rotation} IN ('auto', '3d', 'flat')`),
    check("companion_settings_style_check", sql`${table.style} IN ('pixel', 'smooth')`),
  ],
);

// The visualizations a signed-in visitor chose for the home hero (see
// lib/home-viz-picks.ts). One row per account; no row means "the defaults".
// `picks` is a JSON array of "<subject>/<slug>" keys, 1 to 3 of them. The CHECK
// must stay in sync with MIN/MAX_HOME_VIZ_PICKS. Keys are not foreign keys:
// editorials live in files, not in the database, and an unpublished editorial
// is simply skipped when the home page resolves the list.
export const homeVizPicks = pgTable(
  "home_viz_picks",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    picks: jsonb("picks").$type<string[]>().notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    check(
      "home_viz_picks_picks_check",
      sql`jsonb_typeof(${table.picks}) = 'array' and jsonb_array_length(${table.picks}) between 1 and 3`,
    ),
  ],
);

// Atomic, database-backed daily chatbot budget. The composite key makes the
// upsert safe across serverless instances. `request_count` is Cherenkov's own
// key (limit COMPANION_DAILY_LIMIT). Requests made with a student's personal
// Gemini key use `personal_request_count` instead (limit
// COMPANION_PERSONAL_DAILY_LIMIT), so they never use up the shared allowance.
export const companionUsage = pgTable(
  "companion_usage",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    usageDay: date("usage_day", { mode: "string" }).notNull(),
    requestCount: integer("request_count").notNull().default(0),
    personalRequestCount: integer("personal_request_count").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.usageDay] }),
    check("companion_usage_count_check", sql`${table.requestCount} >= 0`),
    check("companion_usage_personal_count_check", sql`${table.personalRequestCount} >= 0`),
  ],
);

// Saved Neutrino chats. A chat exists only once it has a successful reply, so
// an empty chat never uses one of the COMPANION_MAX_CHATS slots. Every query
// must be filtered by the authenticated user's id. Both tables cascade from
// the user, so deleting an account deletes its chats.
export const companionChats = pgTable(
  "companion_chats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("companion_chats_user_updated_idx").on(table.userId, table.updatedAt),
    check("companion_chats_title_check", sql`char_length(${table.title}) between 1 and 80`),
  ],
);

export const companionChatMessages = pgTable(
  "companion_chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chatId: uuid("chat_id")
      .notNull()
      .references(() => companionChats.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    role: text("role").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("companion_chat_messages_chat_position_idx").on(table.chatId, table.position),
    check("companion_chat_messages_position_check", sql`${table.position} >= 0`),
    check("companion_chat_messages_role_check", sql`${table.role} IN ('user', 'model')`),
    check("companion_chat_messages_body_check", sql`char_length(${table.body}) between 1 and 20000`),
  ],
);

// A student's own "I understood this" flag on a material or editorial. Kept
// separate from the mastery estimate. Keyed by subject as well as slug: slugs
// are only unique within a subject folder.
export const understoodMarks = pgTable(
  "understood_marks",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    subject: subjectEnum("subject").notNull(),
    slug: text("slug").notNull(),
    markedAt: timestamp("marked_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.kind, table.subject, table.slug] }),
    check("understood_marks_kind_check", sql`${table.kind} in ('material', 'editorial')`),
  ],
);

// A student's personal calendar feed (WP6). One per user. Only the SHA-256 hash
// of the secret link token is stored, never the token, so a database read
// cannot reveal a usable link. Regenerating replaces the hash; turning it off
// deletes the row. Cascades from the user.
export const calendarFeeds = pgTable(
  "calendar_feeds",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    // Language of the event titles; the other language goes in the description.
    lang: text("lang").notNull().default("en"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    lastFetchedAt: timestamp("last_fetched_at"),
  },
  (table) => [check("calendar_feeds_lang_check", sql`${table.lang} IN ('en', 'id')`)],
);
