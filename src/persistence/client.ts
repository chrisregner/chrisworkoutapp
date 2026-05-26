import { PGlite } from '@electric-sql/pglite'
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite'
import * as schema from './schema'

export type Db = PgliteDatabase<typeof schema> & { $client: PGlite }

// Eagerly load all migration SQL files at build time. Vite inlines each file
// as a raw string. Drizzle-kit names files `NNNN_<slug>.sql`, so sorting by
// filename yields the correct execution order.
const migrationModules = import.meta.glob('./migrations/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

type MigrationFile = { version: number; name: string; sql: string }

function loadMigrations(): MigrationFile[] {
  const files: MigrationFile[] = []
  for (const [path, sql] of Object.entries(migrationModules)) {
    const filename = path.split('/').pop() ?? path
    const match = filename.match(/^(\d+)_(.+)\.sql$/)
    if (!match) throw new Error(`Unexpected migration filename: ${filename}`)
    const version = Number.parseInt(match[1], 10)
    if (!Number.isFinite(version)) throw new Error(`Bad migration version in ${filename}`)
    files.push({ version, name: match[2], sql })
  }
  files.sort((a, b) => a.version - b.version)
  // Sanity: versions should be unique and contiguous starting at 0.
  for (let i = 0; i < files.length; i++) {
    if (files[i].version !== i) {
      throw new Error(
        `Migration versions must be contiguous starting at 0; got ${files[i].version} at index ${i}`,
      )
    }
  }
  return files
}

let instancePromise: Promise<Db> | null = null

export function getDb(): Promise<Db> {
  if (instancePromise) return instancePromise
  instancePromise = (async () => {
    const client = new PGlite('idb://chrisworkoutapp')
    await client.waitReady
    await runMigrations(client)
    return drizzle(client, { schema }) as Db
  })().catch(err => {
    instancePromise = null
    throw err
  })
  return instancePromise
}

/**
 * Run pending migrations against the supplied PGlite client. Exported so
 * tests and scratch scripts can drive a fresh in-memory DB through the same
 * codepath used at runtime.
 */
export async function runMigrations(client: PGlite): Promise<void> {
  await client.exec(
    `CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE schema_version ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
    ALTER TABLE schema_version ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ NOT NULL DEFAULT now();`,
  )

  const migrations = loadMigrations()
  if (migrations.length === 0) return

  // Bootstrap: a DB that pre-dates this migration system already has all the
  // tables from the original hand-written schema, but no schema_version rows.
  // Detect that case by checking for equipment_defs without any applied
  // migration record, and stamp version 0 (the initial migration) as applied
  // without re-running its SQL — running it would fail on the existing tables.
  const appliedRows = await client.query<{ version: number }>(
    'SELECT version FROM schema_version',
  )
  const applied = new Set(appliedRows.rows.map(r => r.version))

  if (applied.size === 0) {
    const existing = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = current_schema() AND table_name = 'equipment_defs'
       ) AS exists`,
    )
    if (existing.rows[0]?.exists) {
      const init = migrations[0]
      await client.query('INSERT INTO schema_version (version, name) VALUES ($1, $2)', [
        init.version,
        init.name,
      ])
      applied.add(init.version)
    }
  }

  for (const m of migrations) {
    if (applied.has(m.version)) continue
    await client.transaction(async tx => {
      await tx.exec(m.sql)
      await tx.query('INSERT INTO schema_version (version, name) VALUES ($1, $2)', [
        m.version,
        m.name,
      ])
    })
  }
}
