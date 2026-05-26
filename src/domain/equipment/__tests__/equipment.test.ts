import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { InvariantViolationError } from '../../primitives'
import { makeEquipmentDef, makeEquipmentPiece } from '..'

const u = (n: number) => `00000000-0000-0000-0000-${n.toString().padStart(12, '0')}`

describe('makeEquipmentPiece', () => {
  it('builds a valid piece with all fields', () => {
    const piece = makeEquipmentPiece({ id: u(1), resistance: 2.5, quantity: 4, position: 1 })
    expect(piece.id).toBe(u(1))
    expect(piece.resistance).toBe(2.5)
    expect(piece.quantity).toBe(4)
    expect(piece.position).toBe(1)
  })

  it('defaults position to 0 when omitted', () => {
    const piece = makeEquipmentPiece({ id: u(1), resistance: 2.5, quantity: 4 })
    expect(piece.position).toBe(0)
  })

  it('rejects non-positive resistance', () => {
    expect(() => makeEquipmentPiece({ id: u(1), resistance: 0, quantity: 1 })).toThrow(
      InvariantViolationError,
    )
    expect(() => makeEquipmentPiece({ id: u(1), resistance: -1, quantity: 1 })).toThrow(
      InvariantViolationError,
    )
  })

  it('rejects non-positive-integer quantity', () => {
    expect(() => makeEquipmentPiece({ id: u(1), resistance: 5, quantity: 0 })).toThrow(
      InvariantViolationError,
    )
    expect(() => makeEquipmentPiece({ id: u(1), resistance: 5, quantity: -1 })).toThrow(
      InvariantViolationError,
    )
    expect(() => makeEquipmentPiece({ id: u(1), resistance: 5, quantity: 1.5 })).toThrow(
      InvariantViolationError,
    )
  })

  it('rejects an id that is not a well-formed uuid', () => {
    expect(() => makeEquipmentPiece({ id: 'not-a-uuid', resistance: 5, quantity: 1 })).toThrow(
      InvariantViolationError,
    )
  })
})

describe('makeEquipmentDef', () => {
  const validBase = {
    id: u(1),
    isCombinable: true,
    unit: 'kg' as const,
  }

  it('builds a valid equipment def', () => {
    const eq = makeEquipmentDef({
      ...validBase,
      name: 'Plates',
      pieces: [{ id: u(10), resistance: 1.25, quantity: 4, position: 0 }],
    })
    expect(eq.name).toBe('Plates')
    expect(eq.pieces).toHaveLength(1)
  })

  it('rejects empty name', () => {
    expect(() =>
      makeEquipmentDef({
        ...validBase,
        name: '',
        pieces: [{ id: u(10), resistance: 1, quantity: 1, position: 0 }],
      }),
    ).toThrow(InvariantViolationError)
  })

  it('rejects whitespace-only name', () => {
    expect(() =>
      makeEquipmentDef({
        ...validBase,
        name: '   ',
        pieces: [{ id: u(10), resistance: 1, quantity: 1, position: 0 }],
      }),
    ).toThrow(InvariantViolationError)
    expect(() =>
      makeEquipmentDef({
        ...validBase,
        name: '\t\n ',
        pieces: [{ id: u(10), resistance: 1, quantity: 1, position: 0 }],
      }),
    ).toThrow(InvariantViolationError)
  })

  it('rejects empty pieces array', () => {
    expect(() => makeEquipmentDef({ ...validBase, name: 'X', pieces: [] })).toThrow(
      /must have >= 1 piece/,
    )
  })

  it('invariant: piece ids must be unique', () => {
    expect(() =>
      makeEquipmentDef({
        ...validBase,
        name: 'X',
        pieces: [
          { id: u(10), resistance: 1, quantity: 1, position: 0 },
          { id: u(10), resistance: 2, quantity: 1, position: 1 },
        ],
      }),
    ).toThrow(/piece ids must be unique/)
  })

  it('invariant: piece positions must be unique', () => {
    expect(() =>
      makeEquipmentDef({
        ...validBase,
        name: 'X',
        pieces: [
          { id: u(10), resistance: 1, quantity: 1, position: 0 },
          { id: u(11), resistance: 2, quantity: 1, position: 0 },
        ],
      }),
    ).toThrow(/piece positions must be unique/)
  })

  it('property: any pieces array with unique ids and positions builds and round-trips in input order', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            resistance: fc.double({ min: 0.1, max: 1000, noNaN: true, noDefaultInfinity: true }),
            quantity: fc.integer({ min: 1, max: 100 }),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        rawPieces => {
          // Assign unique ids + positions deterministically from index.
          const pieces = rawPieces.map((p, i) => ({
            id: u(100 + i),
            resistance: p.resistance,
            quantity: p.quantity,
            position: i,
          }))
          const eq = makeEquipmentDef({
            id: u(1),
            name: 'Eq',
            isCombinable: true,
            unit: 'kg',
            pieces,
          })
          expect(eq.pieces).toHaveLength(pieces.length)
          // Order preserved.
          eq.pieces.forEach((built, i) => {
            expect(built.id).toBe(pieces[i]!.id)
            expect(built.resistance).toBe(pieces[i]!.resistance)
            expect(built.quantity).toBe(pieces[i]!.quantity)
            expect(built.position).toBe(pieces[i]!.position)
          })
        },
      ),
    )
  })

  it('property: any duplicate-id pieces array is rejected', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 8 }),
        fc.integer({ min: 100, max: 200 }),
        (count, dupId) => {
          // First and last share dupId; positions are all unique.
          const pieces = Array.from({ length: count }, (_, i) => ({
            id: i === 0 || i === count - 1 ? u(dupId) : u(dupId + i + 1),
            resistance: 1,
            quantity: 1,
            position: i,
          }))
          expect(() =>
            makeEquipmentDef({
              id: u(1),
              name: 'Eq',
              isCombinable: true,
              unit: 'kg',
              pieces,
            }),
          ).toThrow(/piece ids must be unique/)
        },
      ),
    )
  })

  it('property: any duplicate-position pieces array is rejected', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 8 }), count => {
        // Unique ids, but two pieces share the same position.
        const pieces = Array.from({ length: count }, (_, i) => ({
          id: u(500 + i),
          resistance: 1,
          quantity: 1,
          position: i === count - 1 ? 0 : i, // last shares position 0 with first
        }))
        expect(() =>
          makeEquipmentDef({
            id: u(1),
            name: 'Eq',
            isCombinable: true,
            unit: 'kg',
            pieces,
          }),
        ).toThrow(/piece positions must be unique/)
      }),
    )
  })
})
