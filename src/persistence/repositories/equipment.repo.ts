import { eq } from 'drizzle-orm'
import type { Db } from '../client'
import { equipmentDefs, equipmentPieces } from '../schema'
import type { EquipmentDef } from '../../domain'
import { equipmentDefToRow, rowsToEquipmentDef } from './mappers'

export async function findEquipmentDef(db: Db, id: string): Promise<EquipmentDef | null> {
  const defRows = await db.select().from(equipmentDefs).where(eq(equipmentDefs.id, id)).limit(1)
  if (defRows.length === 0) return null
  const pieceRows = await db
    .select()
    .from(equipmentPieces)
    .where(eq(equipmentPieces.equipmentDefId, id))
  return rowsToEquipmentDef(defRows[0]!, pieceRows)
}

export async function listEquipmentDefs(db: Db): Promise<EquipmentDef[]> {
  const defRows = await db.select().from(equipmentDefs)
  const pieceRows = await db.select().from(equipmentPieces)
  const byDef = new Map<string, typeof pieceRows>()
  for (const p of pieceRows) {
    const arr = byDef.get(p.equipmentDefId) ?? []
    arr.push(p)
    byDef.set(p.equipmentDefId, arr)
  }
  return defRows.map(d => rowsToEquipmentDef(d, byDef.get(d.id) ?? []))
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
