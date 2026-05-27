import { eq } from 'drizzle-orm'
import type { Db } from '../client'
import { progressionDefs } from '../schema'
import type { ProgressionDef } from '../../domain'
import { EntityNotFoundError } from '../../domain'
import { progressionDefToRow, rowToProgressionDef } from './mappers'
import { progressionDefRowSchema } from './validators'
import { findExerciseDef } from './exercise.repo'

export async function listProgressionsByExercise(db: Db, exerciseId: string): Promise<ProgressionDef[]> {
  const rows = await db.select().from(progressionDefs).where(eq(progressionDefs.exerciseId, exerciseId))
  if (rows.length === 0) return []
  const exercise = await findExerciseDef(db, exerciseId)
  if (!exercise) throw new EntityNotFoundError('exercise', exerciseId)
  return rows.map(row => rowToProgressionDef(progressionDefRowSchema.parse(row), exercise))
}

export async function findProgressionDef(db: Db, id: string): Promise<ProgressionDef | null> {
  const rows = await db.select().from(progressionDefs).where(eq(progressionDefs.id, id)).limit(1)
  if (rows.length === 0) return null
  const row = progressionDefRowSchema.parse(rows[0]!)
  const exercise = await findExerciseDef(db, row.exerciseId)
  if (!exercise) {
    throw new EntityNotFoundError('exercise', row.exerciseId)
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
