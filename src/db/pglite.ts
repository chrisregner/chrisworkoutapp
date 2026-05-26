import { PGlite } from '@electric-sql/pglite'

let instance: PGlite | null = null

export async function getDb(): Promise<PGlite> {
  if (instance) return instance
  instance = new PGlite('idb://chrisworkoutapp')
  await instance.waitReady
  await migrate(instance)
  return instance
}

async function migrate(db: PGlite): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );
  `)
}
