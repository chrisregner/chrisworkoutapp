import { describe, it, expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { runMigrations } from './client'

// Simulates a DB that pre-dates this migration system: contains the original
// hand-written schema (or at least the tables forward migrations need to touch)
// but has no `schema_version` rows. Forward migrations 1+ should apply cleanly
// on top of it; migration 0 should be detected as already-present and stamped
// without re-running.
const CREATE_PREEXISTING = `
  CREATE TABLE equipment_defs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    is_combinable BOOLEAN NOT NULL,
    unit TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE exercise_defs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    quantifier_type TEXT NOT NULL,
    quantifier_rule JSONB NOT NULL,
    resistance_equipment_id UUID REFERENCES equipment_defs(id) ON DELETE RESTRICT,
    should_combine_resistance BOOLEAN,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE progression_defs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    exercise_id UUID NOT NULL REFERENCES exercise_defs(id) ON DELETE CASCADE,
    body_kind TEXT NOT NULL,
    body JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`

describe('runMigrations', () => {
  it('creates the full schema on a fresh DB', async () => {
    const db = new PGlite()
    await db.waitReady
    await runMigrations(db)

    const tables = await db.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name",
    )
    expect(tables.rows.map(r => r.table_name)).toEqual([
      'equipment_defs',
      'equipment_pieces',
      'exercise_defs',
      'program_activity',
      'program_day',
      'program_def',
      'program_microcycle',
      'progression_defs',
      'progression_view_state',
      'schema_version',
    ])

    const checks = await db.query<{ conname: string }>(
      "SELECT conname FROM pg_constraint WHERE contype='c' ORDER BY conname",
    )
    const names = checks.rows.map(r => r.conname)
    expect(names).toContain('equipment_defs_unit_chk')
    expect(names).toContain('equipment_pieces_quantity_chk')
    expect(names).toContain('equipment_pieces_resistance_chk')
    expect(names).toContain('exercise_defs_quantifier_type_chk')
    expect(names).toContain('progression_defs_body_kind_chk')
    expect(names).toContain('progression_defs_body_kind_enum_chk')

    const indexes = await db.query<{ indexname: string }>(
      "SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname NOT LIKE '%_pkey' ORDER BY indexname",
    )
    expect(indexes.rows.map(r => r.indexname)).toEqual(
      expect.arrayContaining(['equipment_pieces_def_idx', 'progression_defs_exercise_idx']),
    )

    const versions = await db.query<{ version: number }>(
      'SELECT version FROM schema_version ORDER BY version',
    )
    expect(versions.rows).toEqual([{ version: 0 }, { version: 1 }, { version: 2 }, { version: 3 }, { version: 4 }, { version: 5 }])
  })

  it('is idempotent', async () => {
    const db = new PGlite()
    await db.waitReady
    await runMigrations(db)
    await runMigrations(db)
    const count = await db.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM schema_version',
    )
    expect(count.rows[0].n).toBe(6)
  })

  it('enforces the unit CHECK', async () => {
    const db = new PGlite()
    await db.waitReady
    await runMigrations(db)
    await expect(
      db.query("INSERT INTO equipment_defs (name, is_combinable, unit) VALUES ('x', false, 'oz')"),
    ).rejects.toThrow()
  })

  it('bootstraps existing pre-migration DBs without re-running SQL', async () => {
    const db = new PGlite()
    await db.waitReady
    await db.exec(CREATE_PREEXISTING)
    await runMigrations(db)
    const ver = await db.query<{ version: number }>(
      'SELECT version FROM schema_version ORDER BY version',
    )
    expect(ver.rows).toEqual([{ version: 0 }, { version: 1 }, { version: 2 }, { version: 3 }, { version: 4 }, { version: 5 }])
  })

  it('backfills plannedSets/plannedReps for pre-existing linear progression rows', async () => {
    // Simulate a DB that pre-dates the planned-axes domain change: progression
    // rows exist with bodies lacking plannedSets/plannedReps. Migration 2's
    // backfill must derive them as the sorted-unique set of values used by
    // each body's volumeSets.
    const db = new PGlite()
    await db.waitReady
    await db.exec(CREATE_PREEXISTING)
    await db.query(
      `INSERT INTO equipment_defs (id, name, is_combinable, unit)
       VALUES ('00000000-0000-4000-8000-000000000001', 'eq', false, 'kg')`,
    )
    await db.query(
      `INSERT INTO exercise_defs (id, name, quantifier_type, quantifier_rule)
       VALUES ('00000000-0000-4000-8000-000000000002', 'ex', 'reps',
               '{"kind":"min-max","min":1,"max":20}'::jsonb)`,
    )
    // Linear body with two volumeSets: sets ∈ {3,5}, quantifierValue ∈ {5,8}
    await db.query(
      `INSERT INTO progression_defs (id, name, exercise_id, body_kind, body)
       VALUES ('00000000-0000-4000-8000-000000000003', 'p',
               '00000000-0000-4000-8000-000000000002', 'linear',
               '{"kind":"linear","volumeSets":[
                  {"sets":5,"quantifierValue":8,"resistanceSource":[]},
                  {"sets":3,"quantifierValue":5,"resistanceSource":[]}
                ]}'::jsonb)`,
    )

    await runMigrations(db)

    const row = await db.query<{ body: { plannedSets: number[]; plannedReps: number[] } }>(
      `SELECT body FROM progression_defs WHERE id = '00000000-0000-4000-8000-000000000003'`,
    )
    expect(row.rows[0]!.body.plannedSets).toEqual([3, 5])
    expect(row.rows[0]!.body.plannedReps).toEqual([5, 8])
  })

  it('backfills plannedSets/plannedReps for pre-existing heavyLight progression rows', async () => {
    const db = new PGlite()
    await db.waitReady
    await db.exec(CREATE_PREEXISTING)
    await db.query(
      `INSERT INTO equipment_defs (id, name, is_combinable, unit)
       VALUES ('00000000-0000-4000-8000-000000000001', 'eq', false, 'kg')`,
    )
    await db.query(
      `INSERT INTO exercise_defs (id, name, quantifier_type, quantifier_rule)
       VALUES ('00000000-0000-4000-8000-000000000002', 'ex', 'reps',
               '{"kind":"min-max","min":1,"max":20}'::jsonb)`,
    )
    // heavyLight: heavy uses sets=3 reps=3, light uses sets=5 reps=8. Union
    // across both → plannedSets=[3,5], plannedReps=[3,8].
    await db.query(
      `INSERT INTO progression_defs (id, name, exercise_id, body_kind, body)
       VALUES ('00000000-0000-4000-8000-000000000003', 'p',
               '00000000-0000-4000-8000-000000000002', 'heavyLight',
               '{"kind":"heavyLight","volumeSets":[{
                  "heavy":{"sets":3,"quantifierValue":3,"resistanceSource":[]},
                  "light":{"sets":5,"quantifierValue":8,"resistanceSource":[]}
                }]}'::jsonb)`,
    )

    await runMigrations(db)

    const row = await db.query<{ body: { plannedSets: number[]; plannedReps: number[] } }>(
      `SELECT body FROM progression_defs WHERE id = '00000000-0000-4000-8000-000000000003'`,
    )
    expect(row.rows[0]!.body.plannedSets).toEqual([3, 5])
    expect(row.rows[0]!.body.plannedReps).toEqual([3, 8])
  })
})
