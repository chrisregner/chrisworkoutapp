import { describe, it, expect } from 'vitest'
import { sql } from 'drizzle-orm'
import { makeTestDb } from '../../testing'
import { saveEquipmentDef } from '../equipment.repo'
import { saveExerciseDef } from '../exercise.repo'
import { findProgressionDef, saveProgressionDef } from '../progression.repo'
import {
  EntityNotFoundError,
  makeEquipmentDef,
  makeExerciseDef,
  makeProgressionDef,
  makeQuantifierRule,
  type EquipmentDef,
  type ExerciseDef,
} from '../../../domain'
import { newId } from '../../../shared'

function buildEquipment(): EquipmentDef {
  return makeEquipmentDef({
    id: newId(),
    name: 'Plates',
    isCombinable: true,
    unit: 'kg',
    pieces: [
      { id: newId(), resistance: 1.25, quantity: 4, position: 0 },
      { id: newId(), resistance: 2.5, quantity: 4, position: 1 },
      { id: newId(), resistance: 5, quantity: 4, position: 2 },
    ],
  })
}

function buildExercise(eq: EquipmentDef): ExerciseDef {
  return makeExerciseDef({
    id: newId(),
    name: 'Squat',
    quantifierType: 'reps',
    quantifierRule: makeQuantifierRule({ kind: 'min-max', min: 1, max: 20 }),
    equipment: eq,
    shouldCombineResistance: true,
  })
}

function snap(eq: EquipmentDef, idx: number) {
  const p = eq.pieces[idx]!
  return { pieceId: p.id as string, resistance: p.resistance as number, quantity: p.quantity as number }
}

async function persistGraph(db: Awaited<ReturnType<typeof makeTestDb>>) {
  const equipment = buildEquipment()
  await saveEquipmentDef(db, equipment)
  const exercise = buildExercise(equipment)
  await saveExerciseDef(db, exercise)
  return { equipment, exercise }
}

describe('progression.repo', () => {
  it('round-trips a linear progression', async () => {
    const db = await makeTestDb()
    const { equipment, exercise } = await persistGraph(db)

    const prog = makeProgressionDef({
      id: newId(),
      name: 'Linear Build',
      exercise,
      body: {
        kind: 'linear',
        volumeSets: [
          {
            sets: 3,
            quantifierValue: 5,
            resistanceSource: [{ piece: snap(equipment, 2), quantity: 2 }],
          },
        ],
      },
    })
    await saveProgressionDef(db, prog)

    const found = await findProgressionDef(db, prog.id)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(prog.id)
    expect(found!.name).toBe('Linear Build')
    expect(found!.body.kind).toBe('linear')
    expect(found!.exercise.id).toBe(exercise.id)
    if (found!.body.kind === 'linear') {
      expect(found!.body.volumeSets).toHaveLength(1)
      expect(found!.body.volumeSets[0]!.sets).toBe(3)
      expect(found!.body.volumeSets[0]!.quantifierValue).toBe(5)
      expect(found!.body.volumeSets[0]!.resistanceSource[0]!.piece.pieceId).toBe(
        equipment.pieces[2]!.id,
      )
    }
  })

  it('round-trips a heavyLight progression', async () => {
    const db = await makeTestDb()
    const { equipment, exercise } = await persistGraph(db)

    const prog = makeProgressionDef({
      id: newId(),
      name: 'HL Cycle',
      exercise,
      body: {
        kind: 'heavyLight',
        volumeSets: [
          {
            heavy: {
              sets: 3,
              quantifierValue: 3,
              resistanceSource: [{ piece: snap(equipment, 2), quantity: 4 }],
            },
            light: {
              sets: 5,
              quantifierValue: 8,
              resistanceSource: [{ piece: snap(equipment, 2), quantity: 2 }],
            },
          },
        ],
      },
    })
    await saveProgressionDef(db, prog)

    const found = await findProgressionDef(db, prog.id)
    expect(found).not.toBeNull()
    expect(found!.body.kind).toBe('heavyLight')
    if (found!.body.kind === 'heavyLight') {
      expect(found!.body.volumeSets).toHaveLength(1)
      expect(found!.body.volumeSets[0]!.heavy.sets).toBe(3)
      expect(found!.body.volumeSets[0]!.light.sets).toBe(5)
    }
  })

  it('findProgressionDef returns null for an unknown id', async () => {
    const db = await makeTestDb()
    const found = await findProgressionDef(db, newId())
    expect(found).toBeNull()
  })

  it('throws EntityNotFoundError when the referenced exercise is missing', async () => {
    const db = await makeTestDb()
    const { equipment, exercise } = await persistGraph(db)

    const prog = makeProgressionDef({
      id: newId(),
      name: 'Orphan',
      exercise,
      body: {
        kind: 'linear',
        volumeSets: [
          {
            sets: 1,
            quantifierValue: 5,
            resistanceSource: [{ piece: snap(equipment, 0), quantity: 1 }],
          },
        ],
      },
    })
    await saveProgressionDef(db, prog)

    // Hard-delete the exercise. The progression FK is ON DELETE CASCADE, which
    // would also wipe the progression — bypass FK enforcement so the
    // progression row remains while its exercise reference dangles.
    await db.execute(sql`SET session_replication_role = 'replica'`)
    await db.execute(sql`DELETE FROM exercise_defs WHERE id = ${exercise.id}`)
    await db.execute(sql`SET session_replication_role = 'origin'`)

    await expect(findProgressionDef(db, prog.id)).rejects.toBeInstanceOf(EntityNotFoundError)
  })
})
