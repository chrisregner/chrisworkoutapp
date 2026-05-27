import { describe, it, expect } from 'vitest'
import { makeTestDb } from '../../testing'
import { saveEquipmentDef } from '../equipment.repo'
import { saveExerciseDef } from '../exercise.repo'
import { deleteProgressionDef, saveProgressionDef } from '../progression.repo'
import {
  findSortOrder,
  saveSortOrder,
  type SortOrder,
} from '../progressionViewState.repo'
import {
  makeEquipmentDef,
  makeExerciseDef,
  makeProgressionDef,
  type EquipmentDef,
  type ExerciseDef,
  type ProgressionDef,
} from '../../../domain'
import { newId } from '../../../shared'

function buildEquipment(): EquipmentDef {
  return makeEquipmentDef({
    id: newId(),
    name: 'Plates',
    isCombinable: true,
    unit: 'kg',
    pieces: [
      { id: newId(), resistance: 2.5, quantity: 4, position: 0 },
      { id: newId(), resistance: 5, quantity: 4, position: 1 },
    ],
  })
}

function buildExercise(eq: EquipmentDef): ExerciseDef {
  return makeExerciseDef({
    id: newId(),
    name: 'Bench',
    quantifierType: 'reps',
    equipment: eq,
    shouldCombineResistance: true,
  })
}

function buildProgression(eq: EquipmentDef, ex: ExerciseDef): ProgressionDef {
  const piece = eq.pieces[0]!
  return makeProgressionDef({
    id: newId(),
    name: 'P',
    exercise: ex,
    body: {
      kind: 'linear',
      volumeSets: [
        {
          sets: 3,
          quantifierValue: 5,
          resistanceSource: [
            {
              piece: {
                pieceId: piece.id as string,
                resistance: piece.resistance as number,
                totalQuantity: piece.quantity as number,
              },
              quantityUsed: 1,
            },
          ],
        },
      ],
      plannedSets: [3],
      plannedReps: [5],
    },
  })
}

async function setupProgression(db: Awaited<ReturnType<typeof makeTestDb>>) {
  const equipment = buildEquipment()
  await saveEquipmentDef(db, equipment)
  const exercise = buildExercise(equipment)
  await saveExerciseDef(db, exercise)
  const progression = buildProgression(equipment, exercise)
  await saveProgressionDef(db, progression)
  return { equipment, exercise, progression }
}

describe('progressionViewState.repo', () => {
  it('findSortOrder returns null when no view-state has been saved', async () => {
    const db = await makeTestDb()
    const { progression } = await setupProgression(db)
    const result = await findSortOrder(db, progression.id)
    expect(result).toBeNull()
  })

  it('save then find returns the same sortOrder', async () => {
    const db = await makeTestDb()
    const { progression } = await setupProgression(db)

    const sortOrder: SortOrder = [
      { column: 'resistance', direction: 'asc' },
      { column: 'sets', direction: 'desc' },
    ]
    await saveSortOrder(db, progression.id, sortOrder)

    const found = await findSortOrder(db, progression.id)
    expect(found).toEqual(sortOrder)
  })

  it('save acts as upsert: a second save overwrites the first', async () => {
    const db = await makeTestDb()
    const { progression } = await setupProgression(db)

    await saveSortOrder(db, progression.id, [{ column: 'resistance', direction: 'asc' }])
    await saveSortOrder(db, progression.id, [
      { column: 'reps', direction: 'desc' },
      { column: 'sets', direction: 'asc' },
    ])

    const found = await findSortOrder(db, progression.id)
    expect(found).toEqual([
      { column: 'reps', direction: 'desc' },
      { column: 'sets', direction: 'asc' },
    ])
  })

  it('CASCADE deletes the view-state row when the parent progression is deleted', async () => {
    const db = await makeTestDb()
    const { progression } = await setupProgression(db)

    await saveSortOrder(db, progression.id, [{ column: 'resistance', direction: 'asc' }])
    expect(await findSortOrder(db, progression.id)).not.toBeNull()

    await deleteProgressionDef(db, progression.id)
    expect(await findSortOrder(db, progression.id)).toBeNull()
  })
})
