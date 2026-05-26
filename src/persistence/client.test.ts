import { describe, it, expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { runMigrations } from './client'

const CREATE_PREEXISTING = `
  CREATE TABLE equipment_defs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    is_combinable BOOLEAN NOT NULL,
    unit TEXT NOT NULL,
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
      'progression_defs',
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
    expect(versions.rows).toEqual([{ version: 0 }])
  })

  it('is idempotent', async () => {
    const db = new PGlite()
    await db.waitReady
    await runMigrations(db)
    await runMigrations(db)
    const count = await db.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM schema_version',
    )
    expect(count.rows[0].n).toBe(1)
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
    await db.query(CREATE_PREEXISTING)
    await runMigrations(db)
    const ver = await db.query<{ version: number }>(
      'SELECT version FROM schema_version ORDER BY version',
    )
    expect(ver.rows).toEqual([{ version: 0 }])
  })
})
