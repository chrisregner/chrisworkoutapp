ALTER TABLE "exercise_defs" DROP COLUMN "selected_piece_ids";
--> statement-breakpoint
-- Manually appended: backfill selectedPieceIds into progression_defs.body.
-- The constraint moved from ExerciseDef to ProgressionDef.body. Existing rows
-- have no record of selectedPieceIds; default every progression body to []
-- (the "no constraint" sentinel). Linear bodies get one top-level field;
-- heavyLight bodies follow the same shape (a single top-level field on the
-- body discriminated union, NOT one per heavy/light arm).
--
-- Wrapped in a DO block so it's safe on bootstrap DBs that pre-date the
-- progression_defs table (no-op when the table does not exist).

DO $$
BEGIN
IF EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = current_schema() AND table_name = 'progression_defs'
) THEN

UPDATE progression_defs
SET body = body || jsonb_build_object('selectedPieceIds', '[]'::jsonb)
WHERE body IS NOT NULL
  AND NOT (body ? 'selectedPieceIds');

END IF;
END $$;
