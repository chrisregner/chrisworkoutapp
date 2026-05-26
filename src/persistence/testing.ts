import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import * as schema from './schema'
import { runMigrations, type Db } from './client'

/**
 * Spin up a fresh in-memory PGLite instance, run all migrations against it,
 * and return the Drizzle-wrapped `Db` handle.
 *
 * Test-only helper. Deliberately does NOT cache like `getDb()` — each test
 * should get its own clean database (cheap with in-memory PGLite).
 */
export async function makeTestDb(): Promise<Db> {
  const client = new PGlite()
  await client.waitReady
  await runMigrations(client)
  return drizzle(client, { schema }) as Db
}
