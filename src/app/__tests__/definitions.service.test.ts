import { describe, it, expect } from 'vitest'
import { makeTestDb } from '../../persistence/testing'
import { DefinitionsService } from '../definitions.service'
import {
  findEquipmentDef,
  findSortOrder,
  type SortOrder,
} from '../../persistence/repositories'
import {
  EntityNotFoundError,
  InvariantViolationError,
  } from '../../domain'
import { newId } from '../../shared'

function freshService(db: Awaited<ReturnType<typeof makeTestDb>>) {
  return new DefinitionsService(db)
}

describe('DefinitionsService', () => {
  it('createEquipment persists and the result is findable', async () => {
    const db = await makeTestDb()
    const service = freshService(db)

    const created = await service.createEquipment({
      name: 'Kettlebells',
      isCombinable: false,
      unit: 'kg',
      pieces: [
        { resistance: 12, quantity: 1, position: 0 },
        { resistance: 16, quantity: 1, position: 1 },
      ],
    })

    const found = await findEquipmentDef(db, created.id)
    expect(found).not.toBeNull()
    expect(found!.name).toBe('Kettlebells')
    expect(found!.pieces).toHaveLength(2)
  })

  it('createEquipment with empty pieces throws InvariantViolationError', async () => {
    const db = await makeTestDb()
    const service = freshService(db)

    await expect(
      service.createEquipment({
        name: 'Nothing',
        isCombinable: false,
        unit: 'kg',
        pieces: [],
      }),
    ).rejects.toBeInstanceOf(InvariantViolationError)
  })

  it('updateEquipment preserves piece IDs (regression for piece-identity bug)', async () => {
    const db = await makeTestDb()
    const service = freshService(db)

    const created = await service.createEquipment({
      name: 'Plates',
      isCombinable: true,
      unit: 'kg',
      pieces: [
        { resistance: 2.5, quantity: 4, position: 0 },
        { resistance: 5, quantity: 4, position: 1 },
      ],
    })
    const originalPieceIds = created.pieces.map(p => p.id)

    // Re-submit the SAME pieces (with their IDs) plus tweak resistance — the
    // ID-preserving path the UI takes when editing existing equipment.
    const updated = await service.updateEquipment(created.id, {
      name: 'Plates v2',
      isCombinable: true,
      unit: 'kg',
      pieces: created.pieces.map(p => ({
        id: p.id as string,
        resistance: p.resistance + 0.5,
        quantity: p.quantity,
        position: p.position,
      })),
    })

    expect(updated.pieces.map(p => p.id)).toEqual(originalPieceIds)
    const reloaded = await findEquipmentDef(db, created.id)
    expect(reloaded).not.toBeNull()
    expect(reloaded!.pieces.map(p => p.id)).toEqual(originalPieceIds)
    expect(reloaded!.name).toBe('Plates v2')
  })

  it('createExercise referencing missing equipment throws EntityNotFoundError', async () => {
    const db = await makeTestDb()
    const service = freshService(db)

    await expect(
      service.createExercise({
        name: 'Curl',
        quantifierType: 'reps',
        equipmentId: newId(),
      }),
    ).rejects.toBeInstanceOf(EntityNotFoundError)
  })

  it('createProgression referencing missing exercise throws EntityNotFoundError', async () => {
    const db = await makeTestDb()
    const service = freshService(db)

    await expect(
      service.createProgression({
        name: 'Orphan progression',
        exerciseId: newId(),
        body: {
          kind: 'linear',
          volumeSets: [{ sets: 1, quantifierValue: 5, resistanceSource: [] }],
          plannedSets: [1],
          plannedReps: [5],
        },
      }),
    ).rejects.toBeInstanceOf(EntityNotFoundError)
  })

  it('createProgression persists initialSortOrder to view-state in the same use case', async () => {
    const db = await makeTestDb()
    const service = freshService(db)

    const ex = await service.createExercise({
      name: 'Pushup',
      quantifierType: 'reps',
      equipmentId: null,
    })
    const sortOrder: SortOrder = [
      { column: 'reps', direction: 'desc' },
      { column: 'sets', direction: 'asc' },
      { column: 'resistance', direction: 'asc' },
    ]

    const created = await service.createProgression({
      name: 'P1',
      exerciseId: ex.id as string,
      body: {
        kind: 'linear',
        volumeSets: [{ sets: 3, quantifierValue: 5, resistanceSource: [] }],
        plannedSets: [3],
        plannedReps: [5],
      },
      initialSortOrder: sortOrder,
    })

    expect(await findSortOrder(db, created.id as string)).toEqual(sortOrder)
  })

  it('createProgression without initialSortOrder writes no view-state row (default applies on read)', async () => {
    const db = await makeTestDb()
    const service = freshService(db)

    const ex = await service.createExercise({
      name: 'Pushup',
      quantifierType: 'reps',
      equipmentId: null,
    })

    const created = await service.createProgression({
      name: 'P1',
      exerciseId: ex.id as string,
      body: {
        kind: 'linear',
        volumeSets: [{ sets: 3, quantifierValue: 5, resistanceSource: [] }],
        plannedSets: [3],
        plannedReps: [5],
      },
    })

    expect(await findSortOrder(db, created.id as string)).toBeNull()
  })

  it('createProgression rolls back the progression row when the view-state write fails (transaction atomicity)', async () => {
    const db = await makeTestDb()
    const service = freshService(db)

    const ex = await service.createExercise({
      name: 'Pushup',
      quantifierType: 'reps',
      equipmentId: null,
    })

    // Malformed sortOrder fails sortOrderSchema.parse inside saveSortOrder.
    // The whole transaction must roll back — including the progression insert
    // that ran first — leaving no orphan domain row behind.
    const badSortOrder = [
      { column: 'not-a-column', direction: 'asc' },
    ] as unknown as SortOrder

    await expect(
      service.createProgression({
        name: 'P-rollback',
        exerciseId: ex.id as string,
        body: {
          kind: 'linear',
          volumeSets: [{ sets: 3, quantifierValue: 5, resistanceSource: [] }],
          plannedSets: [3],
          plannedReps: [5],
        },
        initialSortOrder: badSortOrder,
      }),
    ).rejects.toThrow()

    const progressions = await service.listProgressionsByExercise(ex.id as string)
    expect(progressions).toHaveLength(0)
  })

  it('createProgression with unknown pieceId throws EntityNotFoundError', async () => {
    const db = await makeTestDb()
    const service = freshService(db)

    const eq = await service.createEquipment({
      name: 'Plates',
      isCombinable: true,
      unit: 'kg',
      pieces: [{ resistance: 5, quantity: 4, position: 0 }],
    })
    const ex = await service.createExercise({
      name: 'Squat',
      quantifierType: 'reps',
      equipmentId: eq.id as string,
      shouldCombineResistance: true,
    })

    await expect(
      service.createProgression({
        name: 'Bad progression',
        exerciseId: ex.id as string,
        body: {
          kind: 'linear',
          volumeSets: [{
            sets: 3,
            quantifierValue: 5,
            resistanceSource: [{ piece: { pieceId: newId(), resistance: 5, totalQuantity: 4 }, quantityUsed: 1 }],
          }],
          plannedSets: [3],
          plannedReps: [5],
        },
      }),
    ).rejects.toBeInstanceOf(EntityNotFoundError)
  })
})
