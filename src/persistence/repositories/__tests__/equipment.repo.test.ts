import { describe, it, expect } from 'vitest'
import { makeTestDb } from '../../testing'
import { findEquipmentDef, listEquipmentDefs, saveEquipmentDef } from '../equipment.repo'
import { makeEquipmentDef, type EquipmentDef } from '../../../domain'
import { newId } from '../../../shared'

function sampleEquipment(overrides?: Partial<{ id: string; name: string }>): EquipmentDef {
  return makeEquipmentDef({
    id: overrides?.id ?? newId(),
    name: overrides?.name ?? 'Kettlebell',
    isCombinable: false,
    unit: 'kg',
    pieces: [
      { id: newId(), resistance: 12, quantity: 1, position: 0 },
      { id: newId(), resistance: 16, quantity: 1, position: 1 },
    ],
  })
}

describe('equipment.repo', () => {
  it('round-trips: make -> save -> find returns a domain-equivalent object', async () => {
    const db = await makeTestDb()
    const def = sampleEquipment({ name: 'Kettlebell A' })

    await saveEquipmentDef(db, def)
    const found = await findEquipmentDef(db, def.id)

    expect(found).not.toBeNull()
    expect(found!.id).toBe(def.id)
    expect(found!.name).toBe(def.name)
    expect(found!.isCombinable).toBe(def.isCombinable)
    expect(found!.unit).toBe(def.unit)
    expect(found!.pieces.map(p => ({ ...p }))).toEqual(def.pieces.map(p => ({ ...p })))
  })

  it('findEquipmentDef returns null for an unknown id', async () => {
    const db = await makeTestDb()
    const found = await findEquipmentDef(db, newId())
    expect(found).toBeNull()
  })

  it('listEquipmentDefs returns all saved equipment', async () => {
    const db = await makeTestDb()
    const a = sampleEquipment({ name: 'A' })
    const b = sampleEquipment({ name: 'B' })
    await saveEquipmentDef(db, a)
    await saveEquipmentDef(db, b)

    const all = await listEquipmentDefs(db)
    const names = all.map(e => e.name).sort()
    expect(names).toEqual(['A', 'B'])
    expect(all.find(e => e.id === a.id)!.pieces).toHaveLength(2)
    expect(all.find(e => e.id === b.id)!.pieces).toHaveLength(2)
  })

  it('save acts as upsert: re-saving with the same id updates without duplicating rows', async () => {
    const db = await makeTestDb()
    const original = sampleEquipment({ name: 'Original' })
    await saveEquipmentDef(db, original)

    const updated = makeEquipmentDef({
      id: original.id,
      name: 'Renamed',
      isCombinable: true,
      unit: 'kg',
      pieces: [
        { id: newId(), resistance: 20, quantity: 1, position: 0 },
        { id: newId(), resistance: 24, quantity: 1, position: 1 },
        { id: newId(), resistance: 28, quantity: 1, position: 2 },
      ],
    })
    await saveEquipmentDef(db, updated)

    const all = await listEquipmentDefs(db)
    expect(all).toHaveLength(1)
    expect(all[0]!.name).toBe('Renamed')
    expect(all[0]!.isCombinable).toBe(true)
    expect(all[0]!.pieces).toHaveLength(3)
  })

  it('update preserves piece IDs when the same piece ids are re-supplied', async () => {
    const db = await makeTestDb()
    const original = sampleEquipment({ name: 'Stable' })
    await saveEquipmentDef(db, original)

    const originalPieceIds = original.pieces.map(p => p.id)
    // Re-build with same piece IDs but different resistance values.
    const updated = makeEquipmentDef({
      id: original.id,
      name: 'Stable',
      isCombinable: original.isCombinable,
      unit: original.unit,
      pieces: original.pieces.map((p, i) => ({
        id: p.id,
        resistance: p.resistance + 1,
        quantity: p.quantity,
        position: i,
      })),
    })
    await saveEquipmentDef(db, updated)

    const found = await findEquipmentDef(db, original.id)
    expect(found).not.toBeNull()
    const foundIds = found!.pieces.map(p => p.id)
    expect(foundIds).toEqual(originalPieceIds)
    expect(found!.pieces.map(p => p.resistance)).toEqual([13, 17])
  })
})
