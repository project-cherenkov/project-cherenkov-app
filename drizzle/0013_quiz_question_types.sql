-- Four deterministic quiz question types (single_choice, multiple_select,
-- true_false_set, numeric_response). Forward-only and lossless: nothing is
-- dropped, no row is deleted, and every existing question id, key, prompt,
-- choice, correct answer, status, archive flag and response-history row is
-- preserved. Hand-written like 0006+ (the drizzle/meta snapshots stop at 0005;
-- see docs/engineering/email-and-domain.md), so do NOT regenerate it.
--
-- Final model:
--   quiz_questions.question_type  enum discriminant
--   quiz_questions.content        jsonb, PUBLIC display data (choices / statements / unit)
--   quiz_questions.answer_key     jsonb, SERVER-ONLY answer key
--   quiz_questions.choices / correct_choice_index   DEPRECATED, now nullable, no longer read or written
--   quiz_question_responses.response, question_retries.response   jsonb, type-neutral submitted answer
-- Old selected_choice_index values stay readable: the app falls back to them
-- when `response` is null (lib/quiz-types.ts storedResponse).
CREATE TYPE "public"."question_type" AS ENUM('single_choice', 'multiple_select', 'true_false_set', 'numeric_response');--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD COLUMN "question_type" "question_type" DEFAULT 'single_choice' NOT NULL;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD COLUMN "content" jsonb;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD COLUMN "answer_key" jsonb;--> statement-breakpoint
-- Backfill: every existing row is a single-choice question.
UPDATE "quiz_questions"
SET "content" = jsonb_build_object('type', 'single_choice', 'choices', "choices"),
    "answer_key" = jsonb_build_object('type', 'single_choice', 'correctChoiceIndex', "correct_choice_index")
WHERE "content" IS NULL OR "answer_key" IS NULL;--> statement-breakpoint
ALTER TABLE "quiz_questions" ALTER COLUMN "content" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "quiz_questions" ALTER COLUMN "answer_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "quiz_questions" ALTER COLUMN "choices" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "quiz_questions" ALTER COLUMN "correct_choice_index" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_content_type_check" CHECK ("quiz_questions"."content"->>'type' = "quiz_questions"."question_type"::text);--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_answer_key_type_check" CHECK ("quiz_questions"."answer_key"->>'type' = "quiz_questions"."question_type"::text);--> statement-breakpoint
ALTER TABLE "quiz_question_responses" ADD COLUMN "response" jsonb;--> statement-breakpoint
ALTER TABLE "question_retries" ADD COLUMN "response" jsonb;--> statement-breakpoint
ALTER TABLE "question_retries" ALTER COLUMN "selected_choice_index" DROP NOT NULL;
