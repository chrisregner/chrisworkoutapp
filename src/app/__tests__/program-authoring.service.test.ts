import { describe, it, expect } from 'vitest'
import { makeTestDb } from '../../persistence/testing'
import { DefinitionsService } from '../definitions.service'
import { ProgramAuthoringService } from '../program-authoring.service'
import { EntityNotFoundError, InvariantViolationError } from '../../domain'
import { newId } from '../../shared'

function freshServices(db: Awaited<ReturnType<typeof makeTestDb>>) {
  return {
    defs: new DefinitionsService(db),
    programs: new ProgramAuthoringService(db),
  }
}

async function createExerciseWithHL(defs: DefinitionsService) {
  const eq = await defs.createEquipment({
    name: 'Plates',
    isCombinable: true,
    unit: 'kg',
    pieces: [
      { resistance: 5, quantity: 4, position: 0 },
      { resistance: 10, quantity: 2, position: 1 },
    ],
  })
  const lightPiece = eq.pieces[0]!
  const heavyPiece = eq.pieces[1]!

  const exercise = await defs.createExercise({
    name: 'Squat',
    quantifierType: 'reps',
    equipmentId: eq.id as string,
    shouldCombineResistance: false,
  })

  const hlProg = await defs.createProgression({
    name: 'HL Squat',
    exerciseId: exercise.id as string,
    body: {
      kind: 'heavyLight',
      volumeSets: [
        {
          // heavy: 10kg × 1 set × 5 reps = 50; light: 5kg × 3 sets × 5 reps = 75 ✓
          heavy: {
            sets: 1,
            quantifierValue: 5,
            resistanceSource: [
              {
                piece: {
                  pieceId: heavyPiece.id as string,
                  resistance: heavyPiece.resistance as number,
                  totalQuantity: heavyPiece.quantity as number,
                },
                quantityUsed: 1,
              },
            ],
          },
          light: {
            sets: 3,
            quantifierValue: 5,
            resistanceSource: [
              {
                piece: {
                  pieceId: lightPiece.id as string,
                  resistance: lightPiece.resistance as number,
                  totalQuantity: lightPiece.quantity as number,
                },
                quantityUsed: 1,
              },
            ],
          },
        },
      ],
      plannedSets: [1, 3],
      plannedReps: [5],
    },
  })

  return { exercise, hlProg }
}

describe('ProgramAuthoringService', () => {
  it('createProgram → listPrograms → getProgram round-trips', async () => {
    const db = await makeTestDb()
    const { defs, programs } = freshServices(db)

    const exercise = await defs.createExercise({
      name: 'Press',
      quantifierType: 'reps',
      equipmentId: null,
    })
    const mcId = newId()
    const dayId = newId()

    const created = await programs.createProgram({
      name: 'My Program',
      microcycles: [
        {
          id: mcId,
          label: 'Base',
          days: [
            {
              id: dayId,
              label: 'Day A',
              activities: [
                {
                  kind: 'exercise',
                  exerciseId: exercise.id as string,
                  fallback: { sets: 3, quantifierValue: 5 },
                },
              ],
            },
          ],
        },
      ],
    })

    expect(created.name).toBe('My Program')
    expect(created.microcycles).toHaveLength(1)
    expect(created.microcycles[0]!.label).toBe('Base')
    expect(created.microcycles[0]!.days[0]!.label).toBe('Day A')

    const list = await programs.listPrograms()
    expect(list).toHaveLength(1)
    expect(list[0]!.id).toBe(created.id)

    const fetched = await programs.getProgram(created.id as string)
    expect(fetched.id).toBe(created.id)
    expect(fetched.name).toBe('My Program')
    const act = fetched.microcycles[0]!.days[0]!.activities[0]!
    expect(act.kind).toBe('exercise')
    if (act.kind === 'exercise') {
      expect(act.exercise.id).toBe(exercise.id)
      expect(act.fallback).toBeDefined()
      expect(act.fallback!.sets).toBe(3)
    }
  })

  it('updateProgram replaces children atomically', async () => {
    const db = await makeTestDb()
    const { defs, programs } = freshServices(db)

    const ex1 = await defs.createExercise({
      name: 'Press',
      quantifierType: 'reps',
      equipmentId: null,
    })
    const ex2 = await defs.createExercise({
      name: 'Pull',
      quantifierType: 'reps',
      equipmentId: null,
    })

    const created = await programs.createProgram({
      name: 'Program V1',
      microcycles: [
        {
          id: newId(),
          days: [
            {
              id: newId(),
              activities: [
                { kind: 'exercise', exerciseId: ex1.id as string, fallback: { sets: 3, quantifierValue: 5 } },
              ],
            },
          ],
        },
      ],
    })

    const updated = await programs.updateProgram(created.id as string, {
      name: 'Program V2',
      microcycles: [
        {
          id: newId(),
          days: [
            {
              id: newId(),
              activities: [
                { kind: 'exercise', exerciseId: ex2.id as string, fallback: { sets: 5, quantifierValue: 3 } },
              ],
            },
          ],
        },
      ],
    })

    expect(updated.name).toBe('Program V2')
    const act = updated.microcycles[0]!.days[0]!.activities[0]!
    expect(act.kind).toBe('exercise')
    if (act.kind === 'exercise') {
      expect(act.exercise.id).toBe(ex2.id)
      expect(act.fallback!.sets).toBe(5)
    }

    // Verify persistence — old microcycle gone, new one present
    const reloaded = await programs.getProgram(created.id as string)
    expect(reloaded.microcycles).toHaveLength(1)
    expect(reloaded.microcycles[0]!.id).toBe(updated.microcycles[0]!.id)
  })

  it('deleteProgram removes program and children', async () => {
    const db = await makeTestDb()
    const { defs, programs } = freshServices(db)

    const exercise = await defs.createExercise({
      name: 'Press',
      quantifierType: 'reps',
      equipmentId: null,
    })
    const created = await programs.createProgram({
      name: 'To Delete',
      microcycles: [
        {
          id: newId(),
          days: [
            {
              id: newId(),
              activities: [
                { kind: 'exercise', exerciseId: exercise.id as string, fallback: { sets: 3, quantifierValue: 5 } },
              ],
            },
          ],
        },
      ],
    })

    await programs.deleteProgram(created.id as string)

    const list = await programs.listPrograms()
    expect(list).toHaveLength(0)
    await expect(programs.getProgram(created.id as string)).rejects.toBeInstanceOf(EntityNotFoundError)
  })

  it('createProgram with HL progression and correct hlPick succeeds', async () => {
    const db = await makeTestDb()
    const { defs, programs } = freshServices(db)
    const { exercise, hlProg } = await createExerciseWithHL(defs)

    const created = await programs.createProgram({
      name: 'HL Program',
      microcycles: [
        {
          id: newId(),
          days: [
            {
              id: newId(),
              activities: [
                {
                  kind: 'exercise',
                  exerciseId: exercise.id as string,
                  progressionId: hlProg.id as string,
                  hlPick: 'heavy',
                },
              ],
            },
          ],
        },
      ],
    })

    const act = created.microcycles[0]!.days[0]!.activities[0]!
    expect(act.kind).toBe('exercise')
    if (act.kind === 'exercise') {
      expect(act.hlPick).toBe('heavy')
      expect(act.progression?.id).toBe(hlProg.id)
    }
  })

  it('createProgram with HL progression missing hlPick throws InvariantViolationError', async () => {
    const db = await makeTestDb()
    const { defs, programs } = freshServices(db)
    const { exercise, hlProg } = await createExerciseWithHL(defs)

    await expect(
      programs.createProgram({
        name: 'Bad Program',
        microcycles: [
          {
            id: newId(),
            days: [
              {
                id: newId(),
                activities: [
                  {
                    kind: 'exercise',
                    exerciseId: exercise.id as string,
                    progressionId: hlProg.id as string,
                    // hlPick intentionally omitted
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(InvariantViolationError)
  })

  it('createProgram with unknown exerciseId throws EntityNotFoundError', async () => {
    const db = await makeTestDb()
    const { programs } = freshServices(db)

    await expect(
      programs.createProgram({
        name: 'Ghost Exercise',
        microcycles: [
          {
            id: newId(),
            days: [
              {
                id: newId(),
                activities: [
                  {
                    kind: 'exercise',
                    exerciseId: newId(),
                    fallback: { sets: 3, quantifierValue: 5 },
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(EntityNotFoundError)
  })

  it('createProgram with unknown progressionId throws EntityNotFoundError', async () => {
    const db = await makeTestDb()
    const { defs, programs } = freshServices(db)

    const exercise = await defs.createExercise({
      name: 'Press',
      quantifierType: 'reps',
      equipmentId: null,
    })

    await expect(
      programs.createProgram({
        name: 'Ghost Progression',
        microcycles: [
          {
            id: newId(),
            days: [
              {
                id: newId(),
                activities: [
                  {
                    kind: 'exercise',
                    exerciseId: exercise.id as string,
                    progressionId: newId(),
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(EntityNotFoundError)
  })

  it('updateProgram with unknown id throws EntityNotFoundError', async () => {
    const db = await makeTestDb()
    const { defs, programs } = freshServices(db)

    const exercise = await defs.createExercise({
      name: 'Press',
      quantifierType: 'reps',
      equipmentId: null,
    })

    await expect(
      programs.updateProgram(newId(), {
        name: 'Ghost',
        microcycles: [
          {
            id: newId(),
            days: [
              {
                id: newId(),
                activities: [
                  { kind: 'exercise', exerciseId: exercise.id as string, fallback: { sets: 3, quantifierValue: 5 } },
                ],
              },
            ],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(EntityNotFoundError)
  })

  it('deleteProgram with unknown id throws EntityNotFoundError', async () => {
    const db = await makeTestDb()
    const { programs } = freshServices(db)
    await expect(programs.deleteProgram(newId())).rejects.toBeInstanceOf(EntityNotFoundError)
  })

  it('getProgram with unknown id throws EntityNotFoundError', async () => {
    const db = await makeTestDb()
    const { programs } = freshServices(db)
    await expect(programs.getProgram(newId())).rejects.toBeInstanceOf(EntityNotFoundError)
  })
})
