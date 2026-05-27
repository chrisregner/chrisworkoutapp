import { eq, count } from 'drizzle-orm'
import type { Db } from '../client'
import { exerciseDefs } from '../schema'
import type { ExerciseDef } from '../../domain'
import { EntityNotFoundError } from '../../domain'
import { exerciseDefToRow, rowToExerciseDef } from './mappers'
import { exerciseDefRowSchema } from './validators'
import { findEquipmentDef } from './equipment.repo'

export async function listExerciseDefs(db: Db): Promise<ExerciseDef[]> {
  const rows = await db.select().from(exerciseDefs)
  const parsed = rows.map(r => exerciseDefRowSchema.parse(r))

  const equipmentIds = [...new Set(parsed.map(r => r.resistanceEquipmentId).filter(Boolean) as string[])]
  const equipmentMap = new Map(
    await Promise.all(
      equipmentIds.map(async id => {
        const eq_ = await findEquipmentDef(db, id)
        if (!eq_) throw new EntityNotFoundError('equipment', id)
        return [id, eq_] as const
      }),
    ),
  )

  return parsed.map(row => rowToExerciseDef(row, row.resistanceEquipmentId ? (equipmentMap.get(row.resistanceEquipmentId) ?? null) : null))
}

export async function findExerciseDef(db: Db, id: string): Promise<ExerciseDef | null> {
  const rows = await db.select().from(exerciseDefs).where(eq(exerciseDefs.id, id)).limit(1)
  if (rows.length === 0) return null
  const row = exerciseDefRowSchema.parse(rows[0]!)
  let equipment = null
  if (row.resistanceEquipmentId) {
    equipment = await findEquipmentDef(db, row.resistanceEquipmentId)
    if (!equipment) {
      throw new EntityNotFoundError('equipment', row.resistanceEquipmentId)
    }
  }
  return rowToExerciseDef(row, equipment)
}

export async function countExercisesUsingEquipment(db: Db, equipmentId: string): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(exerciseDefs)
    .where(eq(exerciseDefs.resistanceEquipmentId, equipmentId))
  return rows[0]?.n ?? 0
}

export async function deleteExerciseDef(db: Db, id: string): Promise<void> {
  await db.delete(exerciseDefs).where(eq(exerciseDefs.id, id))
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
        resistanceEquipmentId: row.resistanceEquipmentId,
        shouldCombineResistance: row.shouldCombineResistance,
      },
    })
}
