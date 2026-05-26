import { describe, expect, it } from 'vitest'
import { InvariantViolationError } from '../../primitives'
import { makeEquipmentDef, type EquipmentDef } from '../../equipment'
import { makeExerciseDef, makeQuantifierRule } from '..'

const u = (n: number) => `00000000-0000-0000-0000-${n.toString().padStart(12, '0')}`

function combinableEq(): EquipmentDef {
  return makeEquipmentDef({
    id: u(1),
    name: 'Plates',
    isCombinable: true,
    unit: 'kg',
    pieces: [{ id: u(10), resistance: 1.25, quantity: 4, position: 0 }],
  })
}

function nonCombinableEq(): EquipmentDef {
  return makeEquipmentDef({
    id: u(2),
    name: 'KB',
    isCombinable: false,
    unit: 'kg',
    pieces: [{ id: u(20), resistance: 16, quantity: 1, position: 0 }],
  })
}

const rule = makeQuantifierRule({ kind: 'min-max', min: 1, max: 20 })

describe('makeExerciseDef name guard', () => {
  it('builds with a valid non-empty name', () => {
    const ex = makeExerciseDef({
      id: u(3),
      name: 'Squat',
      quantifierType: 'reps',
      quantifierRule: rule,
      equipment: null,
    })
    expect(ex.name).toBe('Squat')
  })

  it('rejects empty name', () => {
    expect(() =>
      makeExerciseDef({
        id: u(3),
        name: '',
        quantifierType: 'reps',
        quantifierRule: rule,
        equipment: null,
      }),
    ).toThrow(InvariantViolationError)
  })

  it('rejects whitespace-only name', () => {
    expect(() =>
      makeExerciseDef({
        id: u(3),
        name: '   ',
        quantifierType: 'reps',
        quantifierRule: rule,
        equipment: null,
      }),
    ).toThrow(InvariantViolationError)
  })
})

describe('makeExerciseDef quantifier wiring', () => {
  it('preserves the quantifierType and quantifierRule passed in', () => {
    const r = makeQuantifierRule({ kind: 'allowed-values', values: [5, 8, 10] })
    const ex = makeExerciseDef({
      id: u(3),
      name: 'Plank',
      quantifierType: 'seconds',
      quantifierRule: r,
      equipment: null,
    })
    expect(ex.quantifierType).toBe('seconds')
    expect(ex.quantifierRule).toBe(r)
  })
})

describe('makeExerciseDef shouldCombineResistance cross-invariant', () => {
  it('defaults shouldCombineResistance to false when omitted', () => {
    const ex = makeExerciseDef({
      id: u(3),
      name: 'Squat',
      quantifierType: 'reps',
      quantifierRule: rule,
      equipment: combinableEq(),
    })
    expect(ex.shouldCombineResistance).toBe(false)
  })

  it('accepts shouldCombineResistance=true with combinable equipment', () => {
    const ex = makeExerciseDef({
      id: u(3),
      name: 'Squat',
      quantifierType: 'reps',
      quantifierRule: rule,
      equipment: combinableEq(),
      shouldCombineResistance: true,
    })
    expect(ex.shouldCombineResistance).toBe(true)
  })

  it('accepts shouldCombineResistance=false with bodyweight (no equipment)', () => {
    const ex = makeExerciseDef({
      id: u(3),
      name: 'Pushup',
      quantifierType: 'reps',
      quantifierRule: rule,
      equipment: null,
      shouldCombineResistance: false,
    })
    expect(ex.equipment).toBeNull()
    expect(ex.shouldCombineResistance).toBe(false)
  })

  it('rejects shouldCombineResistance=true with no equipment (bodyweight)', () => {
    expect(() =>
      makeExerciseDef({
        id: u(3),
        name: 'Pushup',
        quantifierType: 'reps',
        quantifierRule: rule,
        equipment: null,
        shouldCombineResistance: true,
      }),
    ).toThrow(/requires equipment to be set/)
  })

  it('rejects shouldCombineResistance=true with non-combinable equipment', () => {
    expect(() =>
      makeExerciseDef({
        id: u(3),
        name: 'KB Swing',
        quantifierType: 'reps',
        quantifierRule: rule,
        equipment: nonCombinableEq(),
        shouldCombineResistance: true,
      }),
    ).toThrow(/equipment is not combinable/)
  })

  it('accepts shouldCombineResistance=false with non-combinable equipment', () => {
    const ex = makeExerciseDef({
      id: u(3),
      name: 'KB Swing',
      quantifierType: 'reps',
      quantifierRule: rule,
      equipment: nonCombinableEq(),
      shouldCombineResistance: false,
    })
    expect(ex.shouldCombineResistance).toBe(false)
  })
})

describe('makeExerciseDef id', () => {
  it('rejects a non-uuid id', () => {
    expect(() =>
      makeExerciseDef({
        id: 'not-a-uuid',
        name: 'Squat',
        quantifierType: 'reps',
        quantifierRule: rule,
        equipment: null,
      }),
    ).toThrow(InvariantViolationError)
  })
})
