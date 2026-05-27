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
    equipment: eq,
    shouldCombineResistance: true,
  })
}

function snap(eq: EquipmentDef, idx: number) {
  const p = eq.pieces[idx]!
  return { pieceId: p.id as string, resistance: p.resistance as number, totalQuantity: p.quantity as number }
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
            resistanceSource: [{ piece: snap(equipment, 2), quantityUsed: 2 }],
          },
        ],
        plannedSets: [3],
        plannedReps: [5],
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
              resistanceSource: [{ piece: snap(equipment, 2), quantityUsed: 4 }],
            },
            light: {
              sets: 5,
              quantifierValue: 8,
              resistanceSource: [{ piece: snap(equipment, 2), quantityUsed: 2 }],
            },
          },
        ],
        plannedSets: [3, 5],
        plannedReps: [3, 8],
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
            resistanceSource: [{ piece: snap(equipment, 0), quantityUsed: 1 }],
          },
        ],
        plannedSets: [1],
        plannedReps: [5],
      },
    })
    await saveProgressionDef(db, prog)

    await db.execute(sql`SET session_replication_role = 'replica'`)
    await db.execute(sql`DELETE FROM exercise_defs WHERE id = ${exercise.id}`)
    await db.execute(sql`SET session_replication_role = 'origin'`)

    await expect(findProgressionDef(db, prog.id)).rejects.toBeInstanceOf(EntityNotFoundError)
  })

  it('round-trips plannedSets/plannedReps wider than the values in any volumeSet', async () => {
    const db = await makeTestDb()
    const { equipment, exercise } = await persistGraph(db)

    const prog = makeProgressionDef({
      id: newId(),
      name: 'Linear w/ planned headroom',
      exercise,
      body: {
        kind: 'linear',
        volumeSets: [
          {
            sets: 3,
            quantifierValue: 5,
            resistanceSource: [{ piece: snap(equipment, 1), quantityUsed: 1 }],
          },
        ],
        plannedSets: [3, 4, 5],
        plannedReps: [5, 8, 10, 12],
      },
    })
    await saveProgressionDef(db, prog)

    const found = await findProgressionDef(db, prog.id)
    expect(found).not.toBeNull()
    expect(found!.body.plannedSets.map(n => n as number)).toEqual([3, 4, 5])
    expect(found!.body.plannedReps.map(n => n as number)).toEqual([5, 8, 10, 12])
  })

  it('round-trips plannedSets/plannedReps for heavyLight', async () => {
    const db = await makeTestDb()
    const { equipment, exercise } = await persistGraph(db)

    const prog = makeProgressionDef({
      id: newId(),
      name: 'HL planned',
      exercise,
      body: {
        kind: 'heavyLight',
        volumeSets: [
          {
            heavy: {
              sets: 3,
              quantifierValue: 3,
              resistanceSource: [{ piece: snap(equipment, 2), quantityUsed: 4 }],
            },
            light: {
              sets: 5,
              quantifierValue: 8,
              resistanceSource: [{ piece: snap(equipment, 2), quantityUsed: 2 }],
            },
          },
        ],
        plannedSets: [3, 5, 7],
        plannedReps: [3, 5, 8, 12],
      },
    })
    await saveProgressionDef(db, prog)

    const found = await findProgressionDef(db, prog.id)
    expect(found).not.toBeNull()
    expect(found!.body.plannedSets.map(n => n as number)).toEqual([3, 5, 7])
    expect(found!.body.plannedReps.map(n => n as number)).toEqual([3, 5, 8, 12])
  })
})
