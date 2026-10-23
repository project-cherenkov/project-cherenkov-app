CREATE TABLE "question_retries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"question_id" uuid NOT NULL,
	"correct" boolean NOT NULL,
	"selected_choice_index" smallint NOT NULL,
	"answered_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"subject" "subject",
	"syllabus_topic_id" text,
	"plan_item_id" uuid,
	"started_at" timestamp NOT NULL,
	"duration_seconds" integer NOT NULL,
	"source" text NOT NULL,
	CONSTRAINT "study_sessions_duration_check" CHECK ("study_sessions"."duration_seconds" > 0),
	CONSTRAINT "study_sessions_source_check" CHECK ("study_sessions"."source" in ('timer', 'manual')),
	CONSTRAINT "study_sessions_topic_pair_check" CHECK (("study_sessions"."syllabus_topic_id" is null) or ("study_sessions"."subject" is not null))
);
--> statement-breakpoint
CREATE TABLE "understood_marks" (
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"subject" "subject" NOT NULL,
	"slug" text NOT NULL,
	"marked_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "understood_marks_user_id_kind_subject_slug_pk" PRIMARY KEY("user_id","kind","subject","slug"),
	CONSTRAINT "understood_marks_kind_check" CHECK ("understood_marks"."kind" in ('material', 'editorial'))
);
--> statement-breakpoint
ALTER TABLE "quiz_question_responses" ADD COLUMN "selected_choice_index" smallint;--> statement-breakpoint
ALTER TABLE "question_retries" ADD CONSTRAINT "question_retries_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_retries" ADD CONSTRAINT "question_retries_question_id_quiz_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."quiz_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_plan_item_id_plan_items_id_fk" FOREIGN KEY ("plan_item_id") REFERENCES "public"."plan_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "understood_marks" ADD CONSTRAINT "understood_marks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "question_retries_user_question_idx" ON "question_retries" USING btree ("user_id","question_id");--> statement-breakpoint
CREATE INDEX "study_sessions_user_started_idx" ON "study_sessions" USING btree ("user_id","started_at");