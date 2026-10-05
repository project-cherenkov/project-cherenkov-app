-- Phase 3 scheduler: how a plan was generated, and per-item minutes / order.
--
-- NOTE: drizzle/meta is git-ignored (see 0004's header). Apply this file the
-- same way you applied 0004, after 0004. All three statements are additive and
-- safe on a database that already has plans: existing rows keep working
-- (summary stays NULL, minutes NULL, position 0).

ALTER TABLE "study_plans" ADD COLUMN "summary" jsonb;--> statement-breakpoint
ALTER TABLE "plan_items" ADD COLUMN "minutes" integer;--> statement-breakpoint
ALTER TABLE "plan_items" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "plan_items_plan_scheduled_idx" ON "plan_items" USING btree ("plan_id","scheduled_for");
