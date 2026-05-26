-- Rename JSONB fields in progression_defs.body:
--   resistanceSource[*].piece.quantity  →  resistanceSource[*].piece.totalQuantity
--   resistanceSource[*].quantity        →  resistanceSource[*].quantityUsed
--
-- Wrapped in DO block so it is safe to run on bootstrap DBs that pre-date the
-- progression_defs table (no-op when the table does not exist).

DO $$
BEGIN
IF EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = current_schema() AND table_name = 'progression_defs'
) THEN

UPDATE progression_defs
SET body = CASE (body->>'kind')
  WHEN 'linear' THEN (
    SELECT jsonb_build_object(
      'kind', 'linear',
      'volumeSets', jsonb_agg(
        jsonb_build_object(
          'sets', vs->'sets',
          'quantifierValue', vs->'quantifierValue',
          'resistanceSource', (
            SELECT COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'piece', jsonb_build_object(
                    'pieceId',      rs->'piece'->>'pieceId',
                    'resistance',   rs->'piece'->'resistance',
                    'totalQuantity', rs->'piece'->'quantity'
                  ),
                  'quantityUsed', rs->'quantity'
                )
              ),
              '[]'::jsonb
            )
            FROM jsonb_array_elements(vs->'resistanceSource') AS rs
          )
        )
      )
    )
    FROM jsonb_array_elements(body->'volumeSets') AS vs
  )
  WHEN 'heavyLight' THEN (
    SELECT jsonb_build_object(
      'kind', 'heavyLight',
      'volumeSets', jsonb_agg(
        jsonb_build_object(
          'heavy', jsonb_build_object(
            'sets', pair->'heavy'->'sets',
            'quantifierValue', pair->'heavy'->'quantifierValue',
            'resistanceSource', (
              SELECT COALESCE(
                jsonb_agg(
                  jsonb_build_object(
                    'piece', jsonb_build_object(
                      'pieceId',      rs->'piece'->>'pieceId',
                      'resistance',   rs->'piece'->'resistance',
                      'totalQuantity', rs->'piece'->'quantity'
                    ),
                    'quantityUsed', rs->'quantity'
                  )
                ),
                '[]'::jsonb
              )
              FROM jsonb_array_elements(pair->'heavy'->'resistanceSource') AS rs
            )
          ),
          'light', jsonb_build_object(
            'sets', pair->'light'->'sets',
            'quantifierValue', pair->'light'->'quantifierValue',
            'resistanceSource', (
              SELECT COALESCE(
                jsonb_agg(
                  jsonb_build_object(
                    'piece', jsonb_build_object(
                      'pieceId',      rs->'piece'->>'pieceId',
                      'resistance',   rs->'piece'->'resistance',
                      'totalQuantity', rs->'piece'->'quantity'
                    ),
                    'quantityUsed', rs->'quantity'
                  )
                ),
                '[]'::jsonb
              )
              FROM jsonb_array_elements(pair->'light'->'resistanceSource') AS rs
            )
          )
        )
      )
    )
    FROM jsonb_array_elements(body->'volumeSets') AS pair
  )
END
WHERE body IS NOT NULL;

END IF;
END $$;
