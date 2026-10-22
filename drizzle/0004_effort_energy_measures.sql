ALTER TABLE "body_log" ADD COLUMN "energy" integer;--> statement-breakpoint
ALTER TABLE "body_log" ADD COLUMN "waist_cm" numeric(4, 1);--> statement-breakpoint
ALTER TABLE "body_log" ADD COLUMN "arm_cm" numeric(4, 1);--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "effort" integer;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_effort_range" CHECK ("runs"."effort" is null or "runs"."effort" between 1 and 10);