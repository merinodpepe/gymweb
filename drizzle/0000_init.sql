CREATE TABLE "body_log" (
	"date" date PRIMARY KEY NOT NULL,
	"weight_kg" numeric(5, 2),
	"steps" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercise_alias" (
	"raw_name" text PRIMARY KEY NOT NULL,
	"canonical_name" text NOT NULL,
	"muscle_group" text
);
--> statement-breakpoint
CREATE TABLE "nutrition_log" (
	"date" date PRIMARY KEY NOT NULL,
	"kcal" integer NOT NULL,
	"protein_g" numeric(5, 1) NOT NULL,
	"carbs_g" numeric(5, 1) NOT NULL,
	"fiber_g" numeric(5, 1) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"distance_km" numeric(6, 2) NOT NULL,
	"duration_s" integer NOT NULL,
	"elevation_gain_m" integer DEFAULT 0 NOT NULL,
	"surface" text NOT NULL,
	"notes" text,
	CONSTRAINT "runs_distance_pos" CHECK ("runs"."distance_km" > 0),
	CONSTRAINT "runs_duration_pos" CHECK ("runs"."duration_s" > 0),
	CONSTRAINT "runs_surface" CHECK ("runs"."surface" in ('treadmill','outdoor'))
);
--> statement-breakpoint
CREATE TABLE "workout_exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workout_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"canonical_name" text NOT NULL,
	"notes" text,
	"sets" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" timestamp NOT NULL,
	"routine_name" text NOT NULL,
	"duration_min" integer NOT NULL,
	"total_volume_kg" numeric(8, 1) NOT NULL,
	"raw_text" text NOT NULL,
	"parse_warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "workouts_date_routine" UNIQUE("date","routine_name")
);
--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "runs_date_idx" ON "runs" USING btree ("date");--> statement-breakpoint
CREATE INDEX "we_workout_idx" ON "workout_exercises" USING btree ("workout_id");--> statement-breakpoint
CREATE INDEX "we_canonical_idx" ON "workout_exercises" USING btree ("canonical_name");