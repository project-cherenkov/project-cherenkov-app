CREATE TABLE "companion_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT 'Neutrino' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companion_usage" (
	"user_id" text NOT NULL,
	"usage_day" date NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "companion_usage_user_id_usage_day_pk" PRIMARY KEY("user_id","usage_day"),
	CONSTRAINT "companion_usage_count_check" CHECK ("companion_usage"."request_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "companion_settings" ADD CONSTRAINT "companion_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "companion_usage" ADD CONSTRAINT "companion_usage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
