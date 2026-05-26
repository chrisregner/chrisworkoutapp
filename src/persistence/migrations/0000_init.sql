CREATE TABLE "equipment_defs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_combinable" boolean NOT NULL,
	"unit" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment_pieces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"equipment_def_id" uuid NOT NULL,
	"resistance" double precision NOT NULL,
	"quantity" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "equipment_pieces_quantity_chk" CHECK ("equipment_pieces"."quantity" >= 1),
	CONSTRAINT "equipment_pieces_resistance_chk" CHECK ("equipment_pieces"."resistance" > 0)
);
--> statement-breakpoint
CREATE TABLE "exercise_defs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"quantifier_type" text NOT NULL,
	"quantifier_rule" jsonb NOT NULL,
	"resistance_equipment_id" uuid,
	"should_combine_resistance" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "progression_defs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"exercise_id" uuid NOT NULL,
	"body_kind" text NOT NULL,
	"body" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "progression_defs_body_kind_chk" CHECK ("progression_defs"."body"->>'kind' = "progression_defs"."body_kind")
);
--> statement-breakpoint
ALTER TABLE "equipment_pieces" ADD CONSTRAINT "equipment_pieces_equipment_def_id_equipment_defs_id_fk" FOREIGN KEY ("equipment_def_id") REFERENCES "public"."equipment_defs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_defs" ADD CONSTRAINT "exercise_defs_resistance_equipment_id_equipment_defs_id_fk" FOREIGN KEY ("resistance_equipment_id") REFERENCES "public"."equipment_defs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progression_defs" ADD CONSTRAINT "progression_defs_exercise_id_exercise_defs_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise_defs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Manually appended: text-enum CHECK constraints and supporting indexes.
-- drizzle-kit does not emit CHECK constraints for text({ enum: [...] }) columns,
-- and the schema does not (yet) declare these indexes. Preserved here so the
-- generated migration matches the original hand-written schema exactly.
ALTER TABLE "equipment_defs" ADD CONSTRAINT "equipment_defs_unit_chk" CHECK ("equipment_defs"."unit" IN ('kg','lb'));--> statement-breakpoint
ALTER TABLE "exercise_defs" ADD CONSTRAINT "exercise_defs_quantifier_type_chk" CHECK ("exercise_defs"."quantifier_type" IN ('reps','seconds'));--> statement-breakpoint
ALTER TABLE "progression_defs" ADD CONSTRAINT "progression_defs_body_kind_enum_chk" CHECK ("progression_defs"."body_kind" IN ('linear','heavyLight'));--> statement-breakpoint
CREATE INDEX "equipment_pieces_def_idx" ON "equipment_pieces" ("equipment_def_id");--> statement-breakpoint
CREATE INDEX "progression_defs_exercise_idx" ON "progression_defs" ("exercise_id");