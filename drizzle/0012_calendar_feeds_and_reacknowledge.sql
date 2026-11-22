CREATE TABLE "calendar_feeds" (
	"user_id" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"lang" text DEFAULT 'en' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_fetched_at" timestamp,
	CONSTRAINT "calendar_feeds_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "calendar_feeds_lang_check" CHECK ("calendar_feeds"."lang" IN ('en', 'id'))
);
--> statement-breakpoint
ALTER TABLE "calendar_feeds" ADD CONSTRAINT "calendar_feeds_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Saved chat history is a material change (migration 0011), so every student
-- sees the AI acknowledgement again and re-confirms it.
UPDATE "companion_settings" SET "ai_acknowledged" = false;
