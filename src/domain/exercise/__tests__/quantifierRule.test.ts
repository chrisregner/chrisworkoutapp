import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { makeQuantifierRule, ruleAccepts } from '..'
import { InvariantViolationError } from '../../primitives'

describe('makeQuantifierRule min-max', () => {
  it('accepts valid range', () => {
    const r = makeQuantifierRule({ kind: 'min-max', min: 1, max: 10 })
    expect(r.kind).toBe('min-max')
  })

  it('rejects max < min', () => {
    expect(() => makeQuantifierRule({ kind: 'min-max', min: 5, max: 3 })).toThrow(
      InvariantViolationError,
    )
  })

  it('rejects min < 1', () => {
    expect(() => makeQuantifierRule({ kind: 'min-max', min: 0, max: 10 })).toThrow()
  })

  it('property: accepts iff value in [min,max]', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 1, max: 100 }),
        (a, b, n) => {
          const min = Math.min(a, b)
          const max = Math.max(a, b)
          const rule = makeQuantifierRule({ kind: 'min-max', min, max })
          expect(ruleAccepts(rule, n)).toBe(n >= min && n <= max)
        },
      ),
    )
  })
})

describe('makeQuantifierRule allowed-values', () => {
  it('accepts sorted unique', () => {
    const r = makeQuantifierRule({ kind: 'allowed-values', values: [1, 3, 5, 7] })
    expect(r.kind).toBe('allowed-values')
  })

  it('rejects empty', () => {
    expect(() => makeQuantifierRule({ kind: 'allowed-values', values: [] })).toThrow()
  })

  it('rejects unsorted', () => {
    expect(() => makeQuantifierRule({ kind: 'allowed-values', values: [3, 1, 5] })).toThrow()
  })

  it('rejects duplicates', () => {
    expect(() => makeQuantifierRule({ kind: 'allowed-values', values: [1, 1, 2] })).toThrow()
  })

  it('rejects values < 1', () => {
    expect(() => makeQuantifierRule({ kind: 'allowed-values', values: [0, 1, 2] })).toThrow()
  })
})
