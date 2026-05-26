import { eq } from 'drizzle-orm'
import type { Db } from '../client'
import { equipmentDefs, equipmentPieces } from '../schema'
import type { EquipmentDef } from '../../domain'
import { equipmentDefToRow, rowsToEquipmentDef } from './mappers'
import { equipmentDefRowSchema, equipmentPieceRowSchema } from './validators'

export async function findEquipmentDef(db: Db, id: string): Promise<EquipmentDef | null> {
  const defRows = await db.select().from(equipmentDefs).where(eq(equipmentDefs.id, id)).limit(1)
  if (defRows.length === 0) return null
  const pieceRows = await db
    .select()
    .from(equipmentPieces)
    .where(eq(equipmentPieces.equipmentDefId, id))
  const defRow = equipmentDefRowSchema.parse(defRows[0]!)
  const pieces = pieceRows.map(p => equipmentPieceRowSchema.parse(p))
  return rowsToEquipmentDef(defRow, pieces)
}

export async function listEquipmentDefs(db: Db): Promise<EquipmentDef[]> {
  const defRows = await db.select().from(equipmentDefs)
  const pieceRows = await db.select().from(equipmentPieces)
  const parsedPieces = pieceRows.map(p => equipmentPieceRowSchema.parse(p))
  const byDef = new Map<string, typeof parsedPieces>()
  for (const p of parsedPieces) {
    const arr = byDef.get(p.equipmentDefId) ?? []
    arr.push(p)
    byDef.set(p.equipmentDefId, arr)
  }
  return defRows.map(d => {
    const parsedDef = equipmentDefRowSchema.parse(d)
    return rowsToEquipmentDef(parsedDef, byDef.get(parsedDef.id) ?? [])
  })
}

export async function deleteEquipmentDef(db: Db, id: string): Promise<void> {
  await db.delete(equipmentDefs).where(eq(equipmentDefs.id, id))
}

export async function saveEquipmentDef(db: Db, def: EquipmentDef): Promise<void> {
  const { defRow, pieceRows } = equipmentDefToRow(def)
  await db.transaction(async tx => {
    await tx
      .insert(equipmentDefs)
      .values(defRow)
      .onConflictDoUpdate({
        target: equipmentDefs.id,
        set: {
          name: defRow.name,
          description: defRow.description,
          isCombinable: defRow.isCombinable,
          unit: defRow.unit,
        },
      })
    await tx.delete(equipmentPieces).where(eq(equipmentPieces.equipmentDefId, def.id))
    if (pieceRows.length > 0) {
      await tx.insert(equipmentPieces).values(pieceRows)
    }
  })
}
