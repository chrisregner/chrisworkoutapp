import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { InvariantViolationError } from '../../primitives'
import { makeEquipmentDef } from '../../equipment'
import { makeExerciseDef } from '../../exercise'
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
        plannedSets: [3],
        plannedReps: [5],
      },
    })
    expect(prog.body.kind).toBe('linear')
  })

  it('rejects empty volumeSets', () => {
    const ex = buildExercise(buildEquipment())
    expect(() =>
      makeProgressionDef({
        id: u(3),
        name: 'P',
        exercise: ex,
        body: { kind: 'linear', volumeSets: [], plannedSets: [1], plannedReps: [1] },
      }),
    ).toThrow(InvariantViolationError)
  })

  it('allows empty resistanceSource when exercise has no equipment', () => {
    const ex = buildExercise(null)
    const prog = makeProgressionDef({
      id: u(3),
      name: 'P',
      exercise: ex,
      body: {
        kind: 'linear',
        volumeSets: [{ sets: 3, quantifierValue: 5, resistanceSource: [] }],
        plannedSets: [3],
        plannedReps: [5],
      },
    })
    expect(prog.body.kind).toBe('linear')
  })

  it('allows ad-hoc resistanceSource (no pieceId) when exercise has no equipment', () => {
    const ex = buildExercise(null)
    const prog = makeProgressionDef({
      id: u(3),
      name: 'P',
      exercise: ex,
      body: {
        kind: 'linear',
        volumeSets: [{
          sets: 3,
          quantifierValue: 5,
          resistanceSource: [{ piece: { resistance: 10, totalQuantity: 1 }, quantityUsed: 1 }],
        }],
        plannedSets: [3],
        plannedReps: [5],
      },
    })
    expect(prog.body.kind).toBe('linear')
    if (prog.body.kind === 'linear') {
      expect(prog.body.volumeSets[0]!.resistanceSource[0]!.piece.pieceId).toBeUndefined()
      expect(prog.body.volumeSets[0]!.resistanceSource[0]!.piece.resistance).toBe(10)
    }
  })

  it('rejects empty resistanceSource for equipment exercise', () => {
    const ex = buildExercise(buildEquipment())
    expect(() =>
      makeProgressionDef({
        id: u(3),
        name: 'P',
        exercise: ex,
        body: {
          kind: 'linear',
          volumeSets: [{ sets: 1, quantifierValue: 5, resistanceSource: [] }],
          plannedSets: [1],
          plannedReps: [5],
        },
      }),
    ).toThrow(/required for resistance exercise/)
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
          plannedSets: [1],
          plannedReps: [5],
        },
      }),
    ).toThrow(/combinable/)
  })

  it('rejects quantityUsed exceeding totalQuantity', () => {
    const eq = buildEquipment()
    const ex = buildExercise(eq)
    expect(() =>
      makeProgressionDef({
        id: u(3),
        name: 'P',
        exercise: ex,
        body: {
          kind: 'linear',
          volumeSets: [{ sets: 1, quantifierValue: 5, resistanceSource: [{ piece: snap(eq, 0), quantityUsed: 99 }] }],
          plannedSets: [1],
          plannedReps: [5],
        },
      }),
    ).toThrow(/exceeds available totalQuantity/)
  })

  it('accepts unknown pieceId (historical lineage, not validated against current equipment)', () => {
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
            resistanceSource: [{ piece: { pieceId: u(999), resistance: 5, totalQuantity: 4 }, quantityUsed: 1 }],
          },
        ],
        plannedSets: [1],
        plannedReps: [5],
      },
    })
    const vs = (prog.body as unknown as { kind: 'linear'; volumeSets: any[] }).volumeSets[0]
    expect(vs.resistanceSource[0].piece.pieceId).toBe(u(999))
  })

  it('historical invariant: editing equipment piece after build does not change progression resistance', () => {
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
            resistanceSource: [{ piece: snap(eq, 2), quantityUsed: 2 }],
          },
        ],
        plannedSets: [1],
        plannedReps: [5],
      },
    })
    const vsBefore = (prog.body as unknown as { kind: 'linear'; volumeSets: any[] }).volumeSets[0]
    expect(totalResistance(vsBefore)).toBe(10)

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
    void mutatedEq
    const vsAfter = (prog.body as unknown as { kind: 'linear'; volumeSets: any[] }).volumeSets[0]
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
        plannedSets: [3],
        plannedReps: [3, 10],
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
          plannedSets: [3],
          plannedReps: [5, 8],
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
          plannedSets: [1, 5],
          plannedReps: [3, 10],
        },
      }),
    ).toThrow(/light.volume must exceed/)
  })

  it('property: well-formed HL pair always builds; ill-formed always throws', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 4 }),
        fc.integer({ min: 1, max: 4 }),
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 1, max: 5 }),
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
            plannedSets: [...new Set([hSets, lSets])].sort((a, b) => a - b),
            plannedReps: [...new Set([hReps, lReps])].sort((a, b) => a - b),
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

describe('makeProgressionDef heavyLight cell reuse', () => {
  it('accepts a body where the same (resistance, sets, reps) tuple appears as heavy in one pair and light in another', () => {
    const eq = makeEquipmentDef({
      id: u(1),
      name: 'Plates',
      isCombinable: true,
      unit: 'kg',
      pieces: [
        { id: u(10), resistance: 5, quantity: 4, position: 0 },
        { id: u(11), resistance: 10, quantity: 2, position: 1 },
        { id: u(12), resistance: 15, quantity: 1, position: 2 },
      ],
    })
    const ex = buildExercise(eq)
    const snapPiece = (pieceId: string, resistance: number, qty: number) => ({
      pieceId, resistance, totalQuantity: qty,
    })
    // Pair 1: heavy=10kg×3×5 (vol=150), light=5kg×3×11 (vol=165)   heavy.res 10>5 ✓  light.vol 165>150 ✓
    // Pair 2: heavy=15kg×3×3 (vol=135), light=10kg×3×5 (vol=150)   heavy.res 15>10 ✓  light.vol 150>135 ✓
    // The 10kg×3×5 cell is heavy.resistanceSource of pair 1 AND light.resistanceSource of pair 2.
    const prog = makeProgressionDef({
      id: u(3),
      name: 'HL Reuse',
      exercise: ex,
      body: {
        kind: 'heavyLight',
        volumeSets: [
          {
            heavy: { sets: 3, quantifierValue: 5, resistanceSource: [{ piece: snapPiece(u(11), 10, 2), quantityUsed: 1 }] },
            light: { sets: 3, quantifierValue: 11, resistanceSource: [{ piece: snapPiece(u(10), 5, 4), quantityUsed: 1 }] },
          },
          {
            heavy: { sets: 3, quantifierValue: 3, resistanceSource: [{ piece: snapPiece(u(12), 15, 1), quantityUsed: 1 }] },
            light: { sets: 3, quantifierValue: 5, resistanceSource: [{ piece: snapPiece(u(11), 10, 2), quantityUsed: 1 }] },
          },
        ],
        plannedSets: [3],
        plannedReps: [3, 5, 11],
      },
    })
    expect(prog.body.kind).toBe('heavyLight')
    if (prog.body.kind === 'heavyLight') {
      expect(prog.body.volumeSets).toHaveLength(2)
    }
  })
})

describe('makeProgressionDef heavyLight rest symmetry', () => {
  const eq = buildEquipment()
  const ex = buildExercise(eq)

  // heavy: 5kg × 3 sets × 3 reps = vol 45; light: 2.5kg × 3 × 10 = vol 75 > 45 ✓
  // heavy.resistance 5 > light.resistance 2.5 ✓
  const heavyVs = (restBetweenSets?: number) => ({
    sets: 3,
    quantifierValue: 3,
    resistanceSource: [{ piece: snap(eq, 2), quantityUsed: 1 }],
    ...(restBetweenSets !== undefined ? { restBetweenSets } : {}),
  })
  const lightVs = (restBetweenSets?: number) => ({
    sets: 3,
    quantifierValue: 10,
    resistanceSource: [{ piece: snap(eq, 1), quantityUsed: 1 }],
    ...(restBetweenSets !== undefined ? { restBetweenSets } : {}),
  })

  const buildPair = (heavyRest?: number, lightRest?: number) =>
    makeProgressionDef({
      id: u(3),
      name: 'HL',
      exercise: ex,
      body: {
        kind: 'heavyLight',
        volumeSets: [{ heavy: heavyVs(heavyRest), light: lightVs(lightRest) }],
        plannedSets: [3],
        plannedReps: [3, 10],
      },
    })

  it('accepts when restBetweenSets is set on both heavy and light', () => {
    const prog = buildPair(90, 120)
    expect(prog.body.kind).toBe('heavyLight')
  })

  it('accepts when restBetweenSets is absent on both heavy and light', () => {
    const prog = buildPair(undefined, undefined)
    expect(prog.body.kind).toBe('heavyLight')
  })

  it('rejects when only heavy has restBetweenSets', () => {
    expect(() => buildPair(90, undefined)).toThrow(/restBetweenSets must be set on both/)
  })

  it('rejects when only light has restBetweenSets', () => {
    expect(() => buildPair(undefined, 90)).toThrow(/restBetweenSets must be set on both/)
  })
})

describe('VolumeSet restBetweenSets', () => {
  it('accepts restBetweenSets when provided', () => {
    const ex = buildExercise(null)
    const prog = makeProgressionDef({
      id: u(3),
      name: 'P',
      exercise: ex,
      body: {
        kind: 'linear',
        volumeSets: [{ sets: 3, quantifierValue: 5, resistanceSource: [], restBetweenSets: 90 }],
        plannedSets: [3],
        plannedReps: [5],
      },
    })
    const vs = (prog.body as unknown as { kind: 'linear'; volumeSets: any[] }).volumeSets[0]
    expect(vs.restBetweenSets).toBe(90)
  })

  it('omits restBetweenSets when not provided', () => {
    const ex = buildExercise(null)
    const prog = makeProgressionDef({
      id: u(3),
      name: 'P',
      exercise: ex,
      body: {
        kind: 'linear',
        volumeSets: [{ sets: 3, quantifierValue: 5, resistanceSource: [] }],
        plannedSets: [3],
        plannedReps: [5],
      },
    })
    const vs = (prog.body as unknown as { kind: 'linear'; volumeSets: any[] }).volumeSets[0]
    expect(vs.restBetweenSets).toBeUndefined()
  })

  it('rejects non-positive restBetweenSets', () => {
    const ex = buildExercise(null)
    expect(() =>
      makeProgressionDef({
        id: u(3),
        name: 'P',
        exercise: ex,
        body: {
          kind: 'linear',
          volumeSets: [{ sets: 3, quantifierValue: 5, resistanceSource: [], restBetweenSets: 0 }],
          plannedSets: [3],
          plannedReps: [5],
        },
      }),
    ).toThrow(InvariantViolationError)
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
              { piece: snap(eq, 0), quantityUsed: 2 },
              { piece: snap(eq, 2), quantityUsed: 1 },
            ],
          },
        ],
        plannedSets: [2],
        plannedReps: [5],
      },
    })
    const vs = (prog.body as unknown as { kind: 'linear'; volumeSets: any[] }).volumeSets[0]
    expect(totalResistance(vs)).toBeCloseTo(7.5)
    expect(volumeOf(vs)).toBeCloseTo(2 * 5 * 7.5)
  })
})
