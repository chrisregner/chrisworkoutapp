import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { InvariantViolationError, positiveInt, positiveNumber, uuidOf } from '..'

describe('positiveNumber', () => {
  it('accepts a finite positive number', () => {
    expect(positiveNumber(1)).toBe(1)
    expect(positiveNumber(0.0001)).toBe(0.0001)
    expect(positiveNumber(1000.5)).toBe(1000.5)
  })

  it('rejects zero', () => {
    expect(() => positiveNumber(0)).toThrow(InvariantViolationError)
  })

  it('rejects negative numbers', () => {
    expect(() => positiveNumber(-1)).toThrow(InvariantViolationError)
    expect(() => positiveNumber(-0.5)).toThrow(InvariantViolationError)
  })

  it('rejects NaN', () => {
    expect(() => positiveNumber(NaN)).toThrow(InvariantViolationError)
  })

  it('rejects Infinity and -Infinity', () => {
    expect(() => positiveNumber(Infinity)).toThrow(InvariantViolationError)
    expect(() => positiveNumber(-Infinity)).toThrow(InvariantViolationError)
  })

  it('property: any finite positive number is accepted and returned unchanged', () => {
    fc.assert(
      fc.property(
        fc.double({ min: Number.EPSILON, max: 1e12, noNaN: true, noDefaultInfinity: true }),
        n => {
          expect(positiveNumber(n)).toBe(n)
        },
      ),
    )
  })

  it('property: any non-positive finite number is rejected', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e12, max: 0, noNaN: true, noDefaultInfinity: true }),
        n => {
          expect(() => positiveNumber(n)).toThrow(InvariantViolationError)
        },
      ),
    )
  })
})

describe('positiveInt', () => {
  it('accepts positive integers', () => {
    expect(positiveInt(1)).toBe(1)
    expect(positiveInt(42)).toBe(42)
  })

  it('rejects zero', () => {
    expect(() => positiveInt(0)).toThrow(InvariantViolationError)
  })

  it('rejects negative integers', () => {
    expect(() => positiveInt(-1)).toThrow(InvariantViolationError)
    expect(() => positiveInt(-42)).toThrow(InvariantViolationError)
  })

  it('rejects non-integers (0.5, 1.5, etc.)', () => {
    expect(() => positiveInt(0.5)).toThrow(InvariantViolationError)
    expect(() => positiveInt(1.5)).toThrow(InvariantViolationError)
    expect(() => positiveInt(3.14)).toThrow(InvariantViolationError)
  })

  it('rejects NaN and Infinity', () => {
    expect(() => positiveInt(NaN)).toThrow(InvariantViolationError)
    expect(() => positiveInt(Infinity)).toThrow(InvariantViolationError)
  })

  it('property: any positive integer is accepted', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1_000_000 }), n => {
        expect(positiveInt(n)).toBe(n)
      }),
    )
  })

  it('property: any non-integer in (0, 1) is rejected', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.0001, max: 0.9999, noNaN: true, noDefaultInfinity: true }),
        n => {
          expect(() => positiveInt(n)).toThrow(InvariantViolationError)
        },
      ),
    )
  })
})

describe('uuidOf', () => {
  it('accepts a well-formed lowercase uuid', () => {
    const s = '00000000-0000-0000-0000-000000000001'
    expect(uuidOf(s)).toBe(s)
  })

  it('accepts a well-formed uppercase uuid (case-insensitive)', () => {
    const s = 'ABCDEF12-3456-7890-ABCD-EF1234567890'
    expect(uuidOf(s)).toBe(s)
  })

  it('rejects malformed strings (wrong length, missing dashes, bad chars)', () => {
    expect(() => uuidOf('not-a-uuid')).toThrow(InvariantViolationError)
    expect(() => uuidOf('')).toThrow(InvariantViolationError)
    expect(() => uuidOf('00000000000000000000000000000000')).toThrow(InvariantViolationError)
    expect(() => uuidOf('00000000-0000-0000-0000-00000000000g')).toThrow(InvariantViolationError)
    expect(() => uuidOf('00000000-0000-0000-0000-0000000000001')).toThrow(InvariantViolationError)
  })
})
