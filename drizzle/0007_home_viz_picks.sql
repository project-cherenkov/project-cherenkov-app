CREATE TABLE "home_viz_picks" (
	"user_id" text PRIMARY KEY NOT NULL,
	"picks" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "home_viz_picks_picks_check" CHECK (jsonb_typeof("home_viz_picks"."picks") = 'array' and jsonb_array_length("home_viz_picks"."picks") between 1 and 3)
);
--> statement-breakpoint
ALTER TABLE "home_viz_picks" ADD CONSTRAINT "home_viz_picks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
