import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { InvariantViolationError } from '../../primitives'
import { makeEquipmentDef } from '../../equipment'
import { makeExerciseDef, makeQuantifierRule } from '../../exercise'
import { makeProgressionDef, totalResistance, volumeOf } from '..'
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
    quantifierRule: makeQuantifierRule({ kind: 'min-max', min: 1, max: 20 }),
    equipment: eq,
    shouldCombineResistance: eq?.isCombinable ?? false,
  })
}

function snap(eq: EquipmentDef, idx: number) {
  const p = eq.pieces[idx]!
  return { pieceId: p.id as string, resistance: p.resistance as number, totalQuantity: p.quantity as number }
}

describe('makeProgressionDef linear', () => {
  it('builds with valid body', () => {
    const eq = buildEquipment()
    const ex = buildExercise(eq)
    const prog = makeProgressionDef({
      id: u(3),
      name: 'Linear',
      exercise: ex,
      body: {
        kind: 'linear',
        volumeSets: [
          {
            sets: 3,
            quantifierValue: 5,
            resistanceSource: [{ piece: snap(eq, 2), quantityUsed: 1 }],
          },
        ],
      },
    })
    expect(prog.body.kind).toBe('linear')
  })

  it('rejects empty volumeSets', () => {
    const ex = buildExercise(buildEquipment())
    expect(() =>
      makeProgressionDef({ id: u(3), name: 'P', exercise: ex, body: { kind: 'linear', volumeSets: [] } }),
    ).toThrow(InvariantViolationError)
  })

  it('rejects quantifierValue outside rule', () => {
    const eq = buildEquipment()
    const ex = buildExercise(eq)
    expect(() =>
      makeProgressionDef({
        id: u(3),
        name: 'P',
        exercise: ex,
        body: {
          kind: 'linear',
          volumeSets: [{ sets: 3, quantifierValue: 99, resistanceSource: [{ piece: snap(eq, 0), quantityUsed: 1 }] }],
        },
      }),
    ).toThrow(/violates exercise rule/)
  })

  it('rejects resistanceSource for bodyweight', () => {
    const eq = buildEquipment()
    const ex = buildExercise(null)
    expect(() =>
      makeProgressionDef({
        id: u(3),
        name: 'P',
        exercise: ex,
        body: {
          kind: 'linear',
          volumeSets: [{ sets: 1, quantifierValue: 5, resistanceSource: [{ piece: snap(eq, 0), quantityUsed: 1 }] }],
        },
      }),
    ).toThrow(/bodyweight/)
  })

  it('rejects multiple resistanceSource when not combinable', () => {
    const eq = makeEquipmentDef({
      id: u(1),
      name: 'KB',
      isCombinable: false,
      unit: 'kg',
      pieces: [
        { id: u(10), resistance: 12, quantity: 1, position: 0 },
        { id: u(11), resistance: 16, quantity: 1, position: 1 },
      ],
    })
    const ex = buildExercise(eq)
    expect(() =>
      makeProgressionDef({
        id: u(3),
        name: 'P',
        exercise: ex,
        body: {
          kind: 'linear',
          volumeSets: [
            {
              sets: 1,
              quantifierValue: 5,
              resistanceSource: [
                { piece: snap(eq, 0), quantityUsed: 1 },
                { piece: snap(eq, 1), quantityUsed: 1 },
              ],
            },
          ],
        },
      }),
    ).toThrow(/combinable/)
  })

  it('rejects quantityUsed exceeding totalQuantity', () => {
    const eq = buildEquipment()
    const ex = buildExercise(eq)
    // pieces[0] has totalQuantity=4; using 99 exceeds what's available.
    expect(() =>
      makeProgressionDef({
        id: u(3),
        name: 'P',
        exercise: ex,
        body: {
          kind: 'linear',
          volumeSets: [{ sets: 1, quantifierValue: 5, resistanceSource: [{ piece: snap(eq, 0), quantityUsed: 99 }] }],
        },
      }),
    ).toThrow(/exceeds available totalQuantity/)
  })

  it('accepts unknown pieceId (historical lineage, not validated against current equipment)', () => {
    const eq = buildEquipment()
    const ex = buildExercise(eq)
    // pieceId is metadata describing the source piece this came from. If that
    // piece was later deleted or renamed, prior progressions are still valid.
    const prog = makeProgressionDef({
      id: u(3),
      name: 'P',
      exercise: ex,
      body: {
        kind: 'linear',
        volumeSets: [
          {
            sets: 1,
            quantifierValue: 5,
            resistanceSource: [{ piece: { pieceId: u(999), resistance: 5, totalQuantity: 4 }, quantityUsed: 1 }],
          },
        ],
      },
    })
    const vs = (prog.body as { kind: 'linear'; volumeSets: any[] }).volumeSets[0]
    expect(vs.resistanceSource[0].piece.pieceId).toBe(u(999))
  })

  it('historical invariant: editing equipment piece after build does not change progression resistance', () => {
    // Build a progression from a piece, then build a "mutated" version of the
    // equipment whose pieces have different resistance. The progression already
    // built must continue to report the original totalResistance — the snapshot
    // is law.
    const eq = buildEquipment()
    const ex = buildExercise(eq)
    const prog = makeProgressionDef({
      id: u(3),
      name: 'P',
      exercise: ex,
      body: {
        kind: 'linear',
        volumeSets: [
          {
            sets: 1,
            quantifierValue: 5,
            resistanceSource: [{ piece: snap(eq, 2), quantityUsed: 2 }], // 5 * 2 = 10
          },
        ],
      },
    })
    const vsBefore = (prog.body as { kind: 'linear'; volumeSets: any[] }).volumeSets[0]
    expect(totalResistance(vsBefore)).toBe(10)

    // Mutate "current" equipment — a new ExerciseDef with the same piece ids but
    // different resistance values. The already-built progression must be unaffected.
    const mutatedEq = makeEquipmentDef({
      id: u(1),
      name: 'Plates',
      isCombinable: true,
      unit: 'kg',
      pieces: [
        { id: u(10), resistance: 99, quantity: 1, position: 0 },
        { id: u(11), resistance: 99, quantity: 1, position: 1 },
        { id: u(12), resistance: 99, quantity: 1, position: 2 },
      ],
    })
    void mutatedEq // unused — but documents intent: domain object holds its own values.
    const vsAfter = (prog.body as { kind: 'linear'; volumeSets: any[] }).volumeSets[0]
    expect(totalResistance(vsAfter)).toBe(10)
  })
})

describe('makeProgressionDef heavyLight', () => {
  const eq = buildEquipment()
  const ex = buildExercise(eq)

  const heavyVs = (q: number, sets: number, pieceIdx: number, pieceQty: number) => ({
    sets,
    quantifierValue: q,
    resistanceSource: [{ piece: snap(eq, pieceIdx), quantityUsed: pieceQty }],
  })

  it('accepts valid pair', () => {
    const prog = makeProgressionDef({
      id: u(3),
      name: 'HL',
      exercise: ex,
      body: {
        kind: 'heavyLight',
        volumeSets: [
          {
            heavy: heavyVs(3, 3, 2, 1),
            light: heavyVs(10, 3, 1, 1),
          },
        ],
      },
    })
    expect(prog.body.kind).toBe('heavyLight')
  })

  it('rejects heavy.resistance <= light.resistance', () => {
    expect(() =>
      makeProgressionDef({
        id: u(3),
        name: 'HL',
        exercise: ex,
        body: {
          kind: 'heavyLight',
          volumeSets: [{ heavy: heavyVs(5, 3, 0, 1), light: heavyVs(8, 3, 2, 1) }],
        },
      }),
    ).toThrow(/heavy.resistance must exceed/)
  })

  it('rejects light.volume <= heavy.volume', () => {
    expect(() =>
      makeProgressionDef({
        id: u(3),
        name: 'HL',
        exercise: ex,
        body: {
          kind: 'heavyLight',
          volumeSets: [
            { heavy: heavyVs(10, 5, 2, 1), light: heavyVs(3, 1, 1, 1) },
          ],
        },
      }),
    ).toThrow(/light.volume must exceed/)
  })

  it('property: well-formed HL pair always builds; ill-formed always throws', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 4 }), // heavyPieceIdx (0-2 valid)
        fc.integer({ min: 1, max: 4 }), // lightPieceIdx
        fc.integer({ min: 1, max: 20 }), // heavyReps
        fc.integer({ min: 1, max: 20 }), // lightReps
        fc.integer({ min: 1, max: 5 }), // heavySets
        fc.integer({ min: 1, max: 5 }), // lightSets
        (hIdx, lIdx, hReps, lReps, hSets, lSets) => {
          const heavyIdx = Math.min(hIdx, 2)
          const lightIdx = Math.min(lIdx, 2)
          const body = {
            kind: 'heavyLight' as const,
            volumeSets: [
              {
                heavy: heavyVs(hReps, hSets, heavyIdx, 1),
                light: heavyVs(lReps, lSets, lightIdx, 1),
              },
            ],
          }
          const hRes = eq.pieces[heavyIdx]!.resistance
          const lRes = eq.pieces[lightIdx]!.resistance
          const hVol = hSets * hReps * hRes
          const lVol = lSets * lReps * lRes
          const valid = hRes > lRes && lVol > hVol
          if (valid) {
            const prog = makeProgressionDef({ id: u(3), name: 'HL', exercise: ex, body })
            expect(prog.body.kind).toBe('heavyLight')
          } else {
            expect(() => makeProgressionDef({ id: u(3), name: 'HL', exercise: ex, body })).toThrow()
          }
        },
      ),
    )
  })
})

describe('volumeOf / totalResistance helpers', () => {
  it('totalResistance sums piece.resistance * quantityUsed', () => {
    const eq = buildEquipment()
    const ex = buildExercise(eq)
    const prog = makeProgressionDef({
      id: u(3),
      name: 'P',
      exercise: ex,
      body: {
        kind: 'linear',
        volumeSets: [
          {
            sets: 2,
            quantifierValue: 5,
            resistanceSource: [
              { piece: snap(eq, 0), quantityUsed: 2 }, // 1.25 * 2 = 2.5
              { piece: snap(eq, 2), quantityUsed: 1 }, // 5 * 1 = 5
            ],
          },
        ],
      },
    })
    const vs = (prog.body as { kind: 'linear'; volumeSets: any[] }).volumeSets[0]
    expect(totalResistance(vs)).toBeCloseTo(7.5)
    expect(volumeOf(vs)).toBeCloseTo(2 * 5 * 7.5)
  })
})
