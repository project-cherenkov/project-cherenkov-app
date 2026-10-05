CREATE TYPE "public"."osn_stage" AS ENUM('osn_k', 'osn_p', 'semifinal', 'final');--> statement-breakpoint
CREATE TYPE "public"."plan_item_kind" AS ENUM('confirm', 'study', 'review', 'final_review', 'buffer');--> statement-breakpoint
CREATE TYPE "public"."question_difficulty" AS ENUM('basic', 'intermediate', 'advanced');--> statement-breakpoint
CREATE TYPE "public"."question_status" AS ENUM('draft', 'reviewed');--> statement-breakpoint
CREATE TYPE "public"."subject" AS ENUM('informatics', 'physics', 'astronomy');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"scheduled_for" date NOT NULL,
	"completed_at" timestamp,
	"kind" "plan_item_kind" DEFAULT 'study' NOT NULL,
	"reason" text,
	"minutes" integer,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"topic_id" uuid NOT NULL,
	"score" numeric(4, 3) NOT NULL,
	"attempted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_question_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"correct" boolean NOT NULL,
	"answered_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_id" uuid NOT NULL,
	"prompt" text NOT NULL,
	"choices" jsonb NOT NULL,
	"correct_choice_index" integer NOT NULL,
	"explanation" text,
	"key" text,
	"difficulty" "question_difficulty" NOT NULL,
	"status" "question_status" DEFAULT 'draft' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "study_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"target_exam_date" date NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"summary" jsonb,
	CONSTRAINT "study_plans_user_id_unique" UNIQUE("user_id")
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
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject" "subject" NOT NULL,
	"chapter" text NOT NULL,
	"title" text NOT NULL,
	"order" integer NOT NULL,
	"editorial_slug" text,
	"syllabus_topic_id" text,
	"section_id" text
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
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
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_plan_id_study_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."study_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_question_responses" ADD CONSTRAINT "quiz_question_responses_attempt_id_quiz_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."quiz_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_question_responses" ADD CONSTRAINT "quiz_question_responses_question_id_quiz_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."quiz_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_plans" ADD CONSTRAINT "study_plans_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_self_ratings" ADD CONSTRAINT "topic_self_ratings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_self_ratings" ADD CONSTRAINT "topic_self_ratings_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_planner_settings" ADD CONSTRAINT "user_planner_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "plan_items_plan_scheduled_idx" ON "plan_items" USING btree ("plan_id","scheduled_for");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_question_responses_attempt_question_unique" ON "quiz_question_responses" USING btree ("attempt_id","question_id");--> statement-breakpoint
CREATE INDEX "quiz_question_responses_question_idx" ON "quiz_question_responses" USING btree ("question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_questions_key_unique" ON "quiz_questions" USING btree ("key") WHERE "quiz_questions"."key" is not null;--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "topics_editorial_slug_unique" ON "topics" USING btree ("editorial_slug") WHERE "topics"."editorial_slug" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "topics_subject_syllabus_topic_unique" ON "topics" USING btree ("subject","syllabus_topic_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");