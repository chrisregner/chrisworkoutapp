ALTER TABLE "exercise_defs" DROP COLUMN IF EXISTS "quantifier_rule";--> statement-breakpoint
-- Manually appended: strip selectedPieceIds from existing progression_defs.body
-- blobs. The field was a forward-looking constraint that never earned rent;
-- volumeSets already pin pieces and there is no off-plan logging UX that would
-- consume the whitelist. Safe to drop on read+write.
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
SET body = body - 'selectedPieceIds'
WHERE body IS NOT NULL
  AND body ? 'selectedPieceIds';

END IF;
END $$;
