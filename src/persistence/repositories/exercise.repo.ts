import { eq } from 'drizzle-orm'
import type { Db } from '../client'
import { exerciseDefs } from '../schema'
import type { ExerciseDef } from '../../domain'
import { EntityNotFoundError } from '../../domain'
import { exerciseDefToRow, rowToExerciseDef } from './mappers'
import { findEquipmentDef } from './equipment.repo'

export async function findExerciseDef(db: Db, id: string): Promise<ExerciseDef | null> {
  const rows = await db.select().from(exerciseDefs).where(eq(exerciseDefs.id, id)).limit(1)
  if (rows.length === 0) return null
  const row = rows[0]!
  let equipment = null
  if (row.resistanceEquipmentId) {
    equipment = await findEquipmentDef(db, row.resistanceEquipmentId)
    if (!equipment) {
      throw new EntityNotFoundError('equipment', row.resistanceEquipmentId)
    }
  }
  return rowToExerciseDef(row, equipment)
}

export async function saveExerciseDef(db: Db, def: ExerciseDef): Promise<void> {
  const row = exerciseDefToRow(def)
  await db
    .insert(exerciseDefs)
    .values(row)
    .onConflictDoUpdate({
      target: exerciseDefs.id,
      set: {
        name: row.name,
        description: row.description,
        quantifierType: row.quantifierType,
        quantifierRule: row.quantifierRule,
        resistanceEquipmentId: row.resistanceEquipmentId,
        shouldCombineResistance: row.shouldCombineResistance,
      },
    })
}
