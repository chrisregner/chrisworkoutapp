import { eq } from 'drizzle-orm'
import type { Db } from '../client'
import { progressionDefs } from '../schema'
import type { ProgressionDef } from '../../domain'
import { progressionDefToRow, rowToProgressionDef } from './mappers'
import { findExerciseDef } from './exercise.repo'

export async function findProgressionDef(db: Db, id: string): Promise<ProgressionDef | null> {
  const rows = await db.select().from(progressionDefs).where(eq(progressionDefs.id, id)).limit(1)
  if (rows.length === 0) return null
  const row = rows[0]!
  const exercise = await findExerciseDef(db, row.exerciseId)
  if (!exercise) {
    throw new Error(`progression ${id}: exercise ${row.exerciseId} not found`)
  }
  return rowToProgressionDef(row, exercise)
}

export async function saveProgressionDef(db: Db, def: ProgressionDef): Promise<void> {
  const row = progressionDefToRow(def)
  await db
    .insert(progressionDefs)
    .values(row)
    .onConflictDoUpdate({
      target: progressionDefs.id,
      set: {
        name: row.name,
        exerciseId: row.exerciseId,
        bodyKind: row.bodyKind,
        body: row.body,
      },
    })
}
