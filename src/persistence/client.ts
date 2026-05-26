import { PGlite } from '@electric-sql/pglite'
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite'
import * as schema from './schema'

export type Db = PgliteDatabase<typeof schema> & { $client: PGlite }

let instancePromise: Promise<Db> | null = null

export function getDb(): Promise<Db> {
  if (instancePromise) return instancePromise
  instancePromise = (async () => {
    const client = new PGlite('idb://chrisworkoutapp')
    await client.waitReady
    await migrate(client)
    return drizzle(client, { schema }) as Db
  })().catch(err => {
    instancePromise = null
    throw err
  })
  return instancePromise
}

async function migrate(client: PGlite): Promise<void> {
  await client.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );

    CREATE TABLE IF NOT EXISTS equipment_defs (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name          TEXT NOT NULL,
      description   TEXT,
      is_combinable BOOLEAN NOT NULL,
      unit          TEXT NOT NULL CHECK (unit IN ('kg','lb')),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS equipment_pieces (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      equipment_def_id UUID NOT NULL REFERENCES equipment_defs(id) ON DELETE CASCADE,
      resistance       DOUBLE PRECISION NOT NULL CHECK (resistance > 0),
      quantity         INTEGER NOT NULL CHECK (quantity >= 1),
      position         INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS equipment_pieces_def_idx ON equipment_pieces(equipment_def_id);

    CREATE TABLE IF NOT EXISTS exercise_defs (
      id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name                        TEXT NOT NULL,
      description                 TEXT,
      quantifier_type             TEXT NOT NULL CHECK (quantifier_type IN ('reps','seconds')),
      quantifier_rule             JSONB NOT NULL,
      resistance_equipment_id     UUID REFERENCES equipment_defs(id) ON DELETE RESTRICT,
      should_combine_resistance   BOOLEAN,
      created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS progression_defs (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        TEXT NOT NULL,
      exercise_id UUID NOT NULL REFERENCES exercise_defs(id) ON DELETE CASCADE,
      body_kind   TEXT NOT NULL CHECK (body_kind IN ('linear','heavyLight')),
      body        JSONB NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT progression_defs_body_kind_chk CHECK (body->>'kind' = body_kind)
    );
    CREATE INDEX IF NOT EXISTS progression_defs_exercise_idx ON progression_defs(exercise_id);
  `)
}
