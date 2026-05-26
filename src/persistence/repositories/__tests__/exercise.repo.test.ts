import { describe, it, expect } from 'vitest'
import { sql } from 'drizzle-orm'
import { makeTestDb } from '../../testing'
import { saveEquipmentDef } from '../equipment.repo'
import { findExerciseDef, saveExerciseDef } from '../exercise.repo'
import {
  EntityNotFoundError,
  makeEquipmentDef,
  makeExerciseDef,
  makeQuantifierRule,
  type EquipmentDef,
} from '../../../domain'
import { newId } from '../../../shared'

function sampleEquipment(): EquipmentDef {
  return makeEquipmentDef({
    id: newId(),
    name: 'Dumbbells',
    isCombinable: false,
    unit: 'kg',
    pieces: [
      { id: newId(), resistance: 10, quantity: 2, position: 0 },
      { id: newId(), resistance: 12, quantity: 2, position: 1 },
    ],
  })
}

describe('exercise.repo', () => {
  it('round-trips an exercise that references equipment', async () => {
    const db = await makeTestDb()
    const equipment = sampleEquipment()
    await saveEquipmentDef(db, equipment)

    const exercise = makeExerciseDef({
      id: newId(),
      name: 'Goblet Squat',
      description: 'hold one DB',
      quantifierType: 'reps',
      quantifierRule: makeQuantifierRule({ kind: 'min-max', min: 5, max: 10 }),
      equipment,
      shouldCombineResistance: false,
    })
    await saveExerciseDef(db, exercise)

    const found = await findExerciseDef(db, exercise.id)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(exercise.id)
    expect(found!.name).toBe('Goblet Squat')
    expect(found!.description).toBe('hold one DB')
    expect(found!.quantifierType).toBe('reps')
    expect(found!.quantifierRule).toEqual(exercise.quantifierRule)
    expect(found!.equipment).not.toBeNull()
    expect(found!.equipment!.id).toBe(equipment.id)
    expect(found!.equipment!.pieces).toHaveLength(2)
  })

  it('round-trips a bodyweight exercise (no equipment)', async () => {
    const db = await makeTestDb()
    const exercise = makeExerciseDef({
      id: newId(),
      name: 'Push-up',
      quantifierType: 'reps',
      quantifierRule: makeQuantifierRule({ kind: 'allowed-values', values: [5, 10, 15] }),
      equipment: null,
    })
    await saveExerciseDef(db, exercise)

    const found = await findExerciseDef(db, exercise.id)
    expect(found).not.toBeNull()
    expect(found!.equipment).toBeNull()
    expect(found!.quantifierRule).toEqual(exercise.quantifierRule)
    expect(found!.shouldCombineResistance).toBe(false)
  })

  it('findExerciseDef returns null for an unknown id', async () => {
    const db = await makeTestDb()
    const found = await findExerciseDef(db, newId())
    expect(found).toBeNull()
  })

  it('throws EntityNotFoundError when the referenced equipment is missing', async () => {
    const db = await makeTestDb()
    const equipment = sampleEquipment()
    await saveEquipmentDef(db, equipment)

    const exercise = makeExerciseDef({
      id: newId(),
      name: 'Curl',
      quantifierType: 'reps',
      quantifierRule: makeQuantifierRule({ kind: 'min-max', min: 5, max: 12 }),
      equipment,
    })
    await saveExerciseDef(db, exercise)

    // Simulate a dangling reference: hard-delete the equipment row out from
    // under the exercise. The FK uses ON DELETE RESTRICT, so we briefly
    // suspend trigger/constraint enforcement to create the inconsistent
    // state we want to assert against.
    await db.execute(sql`SET session_replication_role = 'replica'`)
    await db.execute(sql`DELETE FROM equipment_pieces WHERE equipment_def_id = ${equipment.id}`)
    await db.execute(sql`DELETE FROM equipment_defs WHERE id = ${equipment.id}`)
    await db.execute(sql`SET session_replication_role = 'origin'`)

    await expect(findExerciseDef(db, exercise.id)).rejects.toBeInstanceOf(EntityNotFoundError)
  })
})
