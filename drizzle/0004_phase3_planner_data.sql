-- Phase 3 planner data layer (OSN path): syllabus key on topics, per-question
-- responses, question difficulty/status/key, planner settings, self-ratings,
-- plan item kind/reason.
--
-- NOTE: drizzle/meta is git-ignored, so drizzle-kit cannot know this file
-- exists unless its journal is updated locally. If you run `pnpm db:generate`
-- yourself instead of using this file, re-apply the HAND EDIT below.

CREATE TYPE "public"."osn_stage" AS ENUM('osn_k', 'osn_p', 'semifinal', 'final');--> statement-breakpoint
CREATE TYPE "public"."plan_item_kind" AS ENUM('confirm', 'study', 'review', 'final_review', 'buffer');--> statement-breakpoint
CREATE TYPE "public"."question_difficulty" AS ENUM('basic', 'intermediate', 'advanced');--> statement-breakpoint
CREATE TYPE "public"."question_status" AS ENUM('draft', 'reviewed');--> statement-breakpoint
CREATE TABLE "quiz_question_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"correct" boolean NOT NULL,
	"answered_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topic_self_ratings" (
	"user_id" text NOT NULL,
	"topic_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"rated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "topic_self_ratings_user_id_topic_id_pk" PRIMARY KEY("user_id","topic_id"),
	CONSTRAINT "topic_self_ratings_rating_check" CHECK ("topic_self_ratings"."rating" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "user_planner_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"subject" "subject" NOT NULL,
	"stage" "osn_stage" NOT NULL,
	"exam_year" integer NOT NULL,
	"hours_per_week" numeric(4, 1) NOT NULL,
	"timezone" text DEFAULT 'Asia/Jakarta' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_planner_settings_hours_check" CHECK ("user_planner_settings"."hours_per_week" > 0 and "user_planner_settings"."hours_per_week" <= 80),
	CONSTRAINT "user_planner_settings_exam_year_check" CHECK ("user_planner_settings"."exam_year" between 2000 and 2100)
);
--> statement-breakpoint
ALTER TABLE "plan_items" ADD COLUMN "kind" "plan_item_kind" DEFAULT 'study' NOT NULL;--> statement-breakpoint
ALTER TABLE "plan_items" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD COLUMN "key" text;--> statement-breakpoint
-- HAND EDIT: drizzle-kit emits `NOT NULL` with no default here, which fails on a
-- database that already has quiz_questions rows. Existing rows get `intermediate`
-- as an UNREVIEWED backfill (their real difficulty is unknown); the default is
-- dropped straight away so every future question must state its difficulty.
ALTER TABLE "quiz_questions" ADD COLUMN "difficulty" "question_difficulty" DEFAULT 'intermediate' NOT NULL;--> statement-breakpoint
ALTER TABLE "quiz_questions" ALTER COLUMN "difficulty" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD COLUMN "status" "question_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "syllabus_topic_id" text;--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "section_id" text;--> statement-breakpoint
ALTER TABLE "quiz_question_responses" ADD CONSTRAINT "quiz_question_responses_attempt_id_quiz_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."quiz_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_question_responses" ADD CONSTRAINT "quiz_question_responses_question_id_quiz_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."quiz_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_self_ratings" ADD CONSTRAINT "topic_self_ratings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_self_ratings" ADD CONSTRAINT "topic_self_ratings_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_planner_settings" ADD CONSTRAINT "user_planner_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_question_responses_attempt_question_unique" ON "quiz_question_responses" USING btree ("attempt_id","question_id");--> statement-breakpoint
CREATE INDEX "quiz_question_responses_question_idx" ON "quiz_question_responses" USING btree ("question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_questions_key_unique" ON "quiz_questions" USING btree ("key") WHERE "quiz_questions"."key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "topics_subject_syllabus_topic_unique" ON "topics" USING btree ("subject","syllabus_topic_id");
