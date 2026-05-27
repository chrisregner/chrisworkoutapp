import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { InvariantViolationError } from '../../primitives'
import { makeEquipmentDef } from '../../equipment'
import { makeExerciseDef } from '../../exercise'
import { makeProgressionDef } from '..'
import type { EquipmentDef } from '../../equipment'
import type { ExerciseDef } from '../../exercise'

const u = (n: number) => `00000000-0000-0000-0000-${n.toString().padStart(12, '0')}`

function buildEquipment(): EquipmentDef {
  return makeEquipmentDef({
    id: u(1),
    name: 'Plates',
    isCombinable: true,
    unit: 'kg',
    pieces: [
      { id: u(10), resistance: 1.25, quantity: 4, position: 0 },
      { id: u(11), resistance: 2.5, quantity: 4, position: 1 },
      { id: u(12), resistance: 5, quantity: 4, position: 2 },
    ],
  })
}

function buildExercise(eq: EquipmentDef | null): ExerciseDef {
  return makeExerciseDef({
    id: u(2),
    name: 'Squat',
    quantifierType: 'reps',
    equipment: eq,
    shouldCombineResistance: eq?.isCombinable ?? false,
  })
}

function snap(eq: EquipmentDef, idx: number) {
  const p = eq.pieces[idx]!
  return { pieceId: p.id as string, resistance: p.resistance as number, totalQuantity: p.quantity as number }
}

describe('makeProgressionDef planned axes — happy path', () => {
  it('accepts explicit plannedSets/plannedReps that are exact supersets of volumeSet values', () => {
    const eq = buildEquipment()
    const ex = buildExercise(eq)
    const prog = makeProgressionDef({
      id: u(3),
      name: 'P',
      exercise: ex,
      body: {
        kind: 'linear',
        volumeSets: [
          { sets: 3, quantifierValue: 5, resistanceSource: [{ piece: snap(eq, 2), quantityUsed: 1 }] },
        ],
        plannedSets: [3, 4, 5],
        plannedReps: [5, 8, 10],
      },
    })
    expect(prog.body.plannedSets as readonly number[]).toEqual([3, 4, 5])
    expect(prog.body.plannedReps as readonly number[]).toEqual([5, 8, 10])
  })
})

describe('makeProgressionDef planned axes — guards', () => {
  const eq = buildEquipment()
  const ex = buildExercise(eq)

  it('throws InvariantViolationError when plannedSets is empty', () => {
    expect(() =>
      makeProgressionDef({
        id: u(3),
        name: 'P',
        exercise: ex,
        body: {
          kind: 'linear',
          volumeSets: [{ sets: 3, quantifierValue: 5, resistanceSource: [{ piece: snap(eq, 2), quantityUsed: 1 }] }],
          plannedSets: [],
          plannedReps: [5],
        },
      }),
    ).toThrow(InvariantViolationError)
  })

  it('throws InvariantViolationError when plannedReps is empty', () => {
    expect(() =>
      makeProgressionDef({
        id: u(3),
        name: 'P',
        exercise: ex,
        body: {
          kind: 'linear',
          volumeSets: [{ sets: 3, quantifierValue: 5, resistanceSource: [{ piece: snap(eq, 2), quantityUsed: 1 }] }],
          plannedSets: [3],
          plannedReps: [],
        },
      }),
    ).toThrow(InvariantViolationError)
  })

  it('throws InvariantViolationError on a non-positive plannedSets value', () => {
    expect(() =>
      makeProgressionDef({
        id: u(3),
        name: 'P',
        exercise: ex,
        body: {
          kind: 'linear',
          volumeSets: [{ sets: 3, quantifierValue: 5, resistanceSource: [{ piece: snap(eq, 2), quantityUsed: 1 }] }],
          plannedSets: [0, 3],
          plannedReps: [5],
        },
      }),
    ).toThrow(InvariantViolationError)
  })

  it('throws InvariantViolationError on a non-positive plannedReps value', () => {
    expect(() =>
      makeProgressionDef({
        id: u(3),
        name: 'P',
        exercise: ex,
        body: {
          kind: 'linear',
          volumeSets: [{ sets: 3, quantifierValue: 5, resistanceSource: [{ piece: snap(eq, 2), quantityUsed: 1 }] }],
          plannedSets: [3],
          plannedReps: [-1, 5],
        },
      }),
    ).toThrow(InvariantViolationError)
  })

  it('throws when a volumeSet sets value is not in plannedSets', () => {
    expect(() =>
      makeProgressionDef({
        id: u(3),
        name: 'P',
        exercise: ex,
        body: {
          kind: 'linear',
          volumeSets: [{ sets: 7, quantifierValue: 5, resistanceSource: [{ piece: snap(eq, 2), quantityUsed: 1 }] }],
          plannedSets: [3, 4, 5],
          plannedReps: [5],
        },
      }),
    ).toThrow(/plannedSets/)
  })

  it('throws when a volumeSet quantifierValue (reps) is not in plannedReps', () => {
    expect(() =>
      makeProgressionDef({
        id: u(3),
        name: 'P',
        exercise: ex,
        body: {
          kind: 'linear',
          volumeSets: [{ sets: 3, quantifierValue: 7, resistanceSource: [{ piece: snap(eq, 2), quantityUsed: 1 }] }],
          plannedSets: [3],
          plannedReps: [5, 8],
        },
      }),
    ).toThrow(/plannedReps/)
  })
})

describe('makeProgressionDef planned axes — properties', () => {
  const eq = buildEquipment()
  const ex = buildExercise(eq)

  it('property: any input where every volumeSet sets/reps appears in planned arrays constructs successfully', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 1, max: 6 }), { minLength: 1, maxLength: 6 }),
        fc.uniqueArray(fc.integer({ min: 1, max: 20 }), { minLength: 1, maxLength: 6 }),
        fc.integer({ min: 1, max: 4 }),
        (plannedSets, plannedReps, vsCount) => {
          // Build volumeSets whose sets/reps are sampled from the planned arrays.
          const volumeSets = Array.from({ length: vsCount }, (_, i) => ({
            sets: plannedSets[i % plannedSets.length]!,
            quantifierValue: plannedReps[i % plannedReps.length]!,
            resistanceSource: [{ piece: snap(eq, 2), quantityUsed: 1 }],
          }))
          const prog = makeProgressionDef({
            id: u(3),
            name: 'P',
            exercise: ex,
            body: { kind: 'linear', volumeSets, plannedSets, plannedReps },
          })
          // Output must be the deduped+sorted-ascending version of the input.
          const expectedSets = [...new Set(plannedSets)].sort((a, b) => a - b)
          const expectedReps = [...new Set(plannedReps)].sort((a, b) => a - b)
          expect(prog.body.plannedSets as readonly number[]).toEqual(expectedSets)
          expect(prog.body.plannedReps as readonly number[]).toEqual(expectedReps)
        },
      ),
    )
  })

  it('property: a volumeSet citing a sets/reps NOT in the planned arrays always throws InvariantViolationError', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 1, max: 6 }), { minLength: 1, maxLength: 4 }),
        fc.uniqueArray(fc.integer({ min: 1, max: 20 }), { minLength: 1, maxLength: 4 }),
        fc.integer({ min: 7, max: 12 }), // guaranteed outside [1,6]
        fc.integer({ min: 1, max: 20 }),
        (plannedSets, plannedReps, badSets, repsAttempt) => {
          // Pick reps that ARE in plannedReps so only `sets` is offending.
          const reps = plannedReps[repsAttempt % plannedReps.length]!
          expect(() =>
            makeProgressionDef({
              id: u(3),
              name: 'P',
              exercise: ex,
              body: {
                kind: 'linear',
                volumeSets: [{ sets: badSets, quantifierValue: reps, resistanceSource: [{ piece: snap(eq, 2), quantityUsed: 1 }] }],
                plannedSets,
                plannedReps,
              },
            }),
          ).toThrow(InvariantViolationError)
        },
      ),
    )
  })

  it('property: planned arrays are deduped and sorted ascending regardless of input order', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 6 }), { minLength: 1, maxLength: 12 }),
        fc.array(fc.integer({ min: 1, max: 20 }), { minLength: 1, maxLength: 12 }),
        (rawSets, rawReps) => {
          // Volume set must cite values present in the planned arrays. Pick
          // any one value from each to guarantee the superset invariant.
          const sampleSets = rawSets[0]!
          const sampleReps = rawReps[0]!
          const prog = makeProgressionDef({
            id: u(3),
            name: 'P',
            exercise: ex,
            body: {
              kind: 'linear',
              volumeSets: [{ sets: sampleSets, quantifierValue: sampleReps, resistanceSource: [{ piece: snap(eq, 2), quantityUsed: 1 }] }],
              plannedSets: rawSets,
              plannedReps: rawReps,
            },
          })
          const expectedSets = [...new Set(rawSets)].sort((a, b) => a - b)
          const expectedReps = [...new Set(rawReps)].sort((a, b) => a - b)
          expect(prog.body.plannedSets as readonly number[]).toEqual(expectedSets)
          expect(prog.body.plannedReps as readonly number[]).toEqual(expectedReps)
          // Sorted ascending invariant — explicit assertion, not redundant.
          const out = prog.body.plannedSets as readonly number[]
          for (let i = 1; i < out.length; i++) expect(out[i]!).toBeGreaterThan(out[i - 1]!)
        },
      ),
    )
  })

  it('property: non-positive planned values always throw', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -10, max: 0 }), { minLength: 1, maxLength: 4 }),
        badValues => {
          expect(() =>
            makeProgressionDef({
              id: u(3),
              name: 'P',
              exercise: ex,
              body: {
                kind: 'linear',
                volumeSets: [{ sets: 3, quantifierValue: 5, resistanceSource: [{ piece: snap(eq, 2), quantityUsed: 1 }] }],
                plannedSets: [3, ...badValues],
                plannedReps: [5],
              },
            }),
          ).toThrow(InvariantViolationError)
        },
      ),
    )
  })
})

describe('makeProgressionDef planned axes — heavyLight bodies', () => {
  const eq = buildEquipment()
  const ex = buildExercise(eq)

  it('throws when a heavy volumeSet cites sets/reps not in the planned arrays', () => {
    expect(() =>
      makeProgressionDef({
        id: u(3),
        name: 'HL',
        exercise: ex,
        body: {
          kind: 'heavyLight',
          volumeSets: [
            {
              heavy: { sets: 7, quantifierValue: 3, resistanceSource: [{ piece: snap(eq, 2), quantityUsed: 1 }] },
              light: { sets: 3, quantifierValue: 10, resistanceSource: [{ piece: snap(eq, 1), quantityUsed: 1 }] },
            },
          ],
          plannedSets: [3],
          plannedReps: [3, 10],
        },
      }),
    ).toThrow(/plannedSets/)
  })

  it('throws when a light volumeSet cites a reps value not in plannedReps', () => {
    expect(() =>
      makeProgressionDef({
        id: u(3),
        name: 'HL',
        exercise: ex,
        body: {
          kind: 'heavyLight',
          volumeSets: [
            {
              heavy: { sets: 3, quantifierValue: 3, resistanceSource: [{ piece: snap(eq, 2), quantityUsed: 1 }] },
              light: { sets: 3, quantifierValue: 99, resistanceSource: [{ piece: snap(eq, 1), quantityUsed: 1 }] },
            },
          ],
          plannedSets: [3],
          plannedReps: [3, 10],
        },
      }),
    ).toThrow() // throws — either superset or rule violation; first triggered guard wins
  })
})
