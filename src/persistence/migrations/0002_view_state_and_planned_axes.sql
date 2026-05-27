CREATE TABLE "progression_view_state" (
	"progression_def_id" uuid PRIMARY KEY NOT NULL,
	"sort_order" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exercise_defs" ADD COLUMN "selected_piece_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "progression_view_state" ADD CONSTRAINT "progression_view_state_progression_def_id_progression_defs_id_fk" FOREIGN KEY ("progression_def_id") REFERENCES "public"."progression_defs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Manually appended: backfill plannedSets/plannedReps into progression_defs.body.
-- These domain fields were added to ProgressionBody (both linear + heavyLight).
-- Existing rows have no record of them; derive sorted-unique sets/reps from the
-- existing volumeSets so the superset invariant trivially holds on re-read.
--
-- Wrapped in DO block so it's safe on bootstrap DBs that pre-date the
-- progression_defs table (no-op when the table does not exist).

DO $$
BEGIN
IF EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = current_schema() AND table_name = 'progression_defs'
) THEN

UPDATE progression_defs
SET body = CASE (body->>'kind')
  WHEN 'linear' THEN
    body
    || jsonb_build_object(
      'plannedSets', (
        SELECT COALESCE(jsonb_agg(s ORDER BY s), '[]'::jsonb)
        FROM (
          SELECT DISTINCT (vs->>'sets')::int AS s
          FROM jsonb_array_elements(body->'volumeSets') AS vs
        ) AS distinct_sets
      ),
      'plannedReps', (
        SELECT COALESCE(jsonb_agg(r ORDER BY r), '[]'::jsonb)
        FROM (
          SELECT DISTINCT (vs->>'quantifierValue')::int AS r
          FROM jsonb_array_elements(body->'volumeSets') AS vs
        ) AS distinct_reps
      )
    )
  WHEN 'heavyLight' THEN
    body
    || jsonb_build_object(
      'plannedSets', (
        SELECT COALESCE(jsonb_agg(s ORDER BY s), '[]'::jsonb)
        FROM (
          SELECT DISTINCT s FROM (
            SELECT (pair->'heavy'->>'sets')::int AS s
            FROM jsonb_array_elements(body->'volumeSets') AS pair
            UNION ALL
            SELECT (pair->'light'->>'sets')::int AS s
            FROM jsonb_array_elements(body->'volumeSets') AS pair
          ) AS all_sets
        ) AS distinct_sets
      ),
      'plannedReps', (
        SELECT COALESCE(jsonb_agg(r ORDER BY r), '[]'::jsonb)
        FROM (
          SELECT DISTINCT r FROM (
            SELECT (pair->'heavy'->>'quantifierValue')::int AS r
            FROM jsonb_array_elements(body->'volumeSets') AS pair
            UNION ALL
            SELECT (pair->'light'->>'quantifierValue')::int AS r
            FROM jsonb_array_elements(body->'volumeSets') AS pair
          ) AS all_reps
        ) AS distinct_reps
      )
    )
END
WHERE body IS NOT NULL
  AND NOT (body ? 'plannedSets' AND body ? 'plannedReps');

END IF;
END $$;
