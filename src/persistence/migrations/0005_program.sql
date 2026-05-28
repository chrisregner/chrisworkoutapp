CREATE TABLE "program_def" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "program_microcycle" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "program_id" uuid NOT NULL REFERENCES "program_def"("id") ON DELETE CASCADE,
  "cycle_index" integer NOT NULL,
  "label" text,
  CONSTRAINT "program_microcycle_program_id_cycle_index_unique" UNIQUE("program_id", "cycle_index")
);
--> statement-breakpoint
CREATE TABLE "program_day" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "microcycle_id" uuid NOT NULL REFERENCES "program_microcycle"("id") ON DELETE CASCADE,
  "day_index" integer NOT NULL,
  "label" text,
  CONSTRAINT "program_day_microcycle_id_day_index_unique" UNIQUE("microcycle_id", "day_index")
);
--> statement-breakpoint
CREATE TABLE "program_activity" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "day_id" uuid NOT NULL REFERENCES "program_day"("id") ON DELETE CASCADE,
  "position" integer NOT NULL,
  "kind" text NOT NULL CHECK ("kind" IN ('rest', 'exercise')),
  "body" jsonb NOT NULL,
  CONSTRAINT "program_activity_day_id_position_unique" UNIQUE("day_id", "position"),
  CONSTRAINT "program_activity_body_kind_chk" CHECK ("body"->>'kind' = "kind")
);
