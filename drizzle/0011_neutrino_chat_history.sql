ALTER TABLE "companion_settings" ADD COLUMN "style" text DEFAULT 'pixel' NOT NULL;--> statement-breakpoint
ALTER TABLE "companion_settings" ADD CONSTRAINT "companion_settings_style_check" CHECK ("companion_settings"."style" IN ('pixel', 'smooth'));--> statement-breakpoint
ALTER TABLE "companion_usage" ADD COLUMN "personal_request_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "companion_usage" ADD CONSTRAINT "companion_usage_personal_count_check" CHECK ("companion_usage"."personal_request_count" >= 0);--> statement-breakpoint
CREATE TABLE "companion_chats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "companion_chats_title_check" CHECK (char_length("companion_chats"."title") between 1 and 80)
);
--> statement-breakpoint
CREATE TABLE "companion_chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"role" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "companion_chat_messages_position_check" CHECK ("companion_chat_messages"."position" >= 0),
	CONSTRAINT "companion_chat_messages_role_check" CHECK ("companion_chat_messages"."role" IN ('user', 'model')),
	CONSTRAINT "companion_chat_messages_body_check" CHECK (char_length("companion_chat_messages"."body") between 1 and 20000)
);
--> statement-breakpoint
ALTER TABLE "companion_chats" ADD CONSTRAINT "companion_chats_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companion_chat_messages" ADD CONSTRAINT "companion_chat_messages_chat_id_companion_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."companion_chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "companion_chats_user_updated_idx" ON "companion_chats" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "companion_chat_messages_chat_position_idx" ON "companion_chat_messages" USING btree ("chat_id","position");
