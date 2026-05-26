import { describe, it, expect } from 'vitest'
import { makeTestDb } from '../../persistence/testing'
import { ProgramAuthoringService } from '../programAuthoring.service'
import { findEquipmentDef } from '../../persistence/repositories'
import {
  EntityNotFoundError,
  InvariantViolationError,
  makeQuantifierRule,
} from '../../domain'
import { newId } from '../../shared'

function freshService(db: Awaited<ReturnType<typeof makeTestDb>>) {
  return new ProgramAuthoringService(db)
}

describe('ProgramAuthoringService', () => {
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
        quantifierRule: makeQuantifierRule({ kind: 'min-max', min: 5, max: 10 }),
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
        },
      }),
    ).rejects.toBeInstanceOf(EntityNotFoundError)
  })
})
