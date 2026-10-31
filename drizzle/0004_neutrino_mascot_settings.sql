ALTER TABLE "companion_settings" ADD COLUMN "enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "companion_settings" ADD COLUMN "size" text DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "companion_settings" ADD COLUMN "rotation" text DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE "companion_settings" ADD CONSTRAINT "companion_settings_size_check" CHECK ("companion_settings"."size" IN ('small', 'medium', 'large'));--> statement-breakpoint
ALTER TABLE "companion_settings" ADD CONSTRAINT "companion_settings_rotation_check" CHECK ("companion_settings"."rotation" IN ('auto', '3d', 'flat'));