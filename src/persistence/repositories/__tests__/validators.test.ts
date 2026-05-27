import { describe, it, expect } from 'vitest'
import {
  equipmentDefRowSchema,
  equipmentPieceRowSchema,
  exerciseDefRowSchema,
  progressionBodySchema,
  progressionDefRowSchema,
  volumeSetSchema,
} from '../validators'

/**
 * These schemas are shape-only by design. The principle, restated:
 *
 *   "re-parse to confirm — don't redefine"
 *
 * Domain invariants (sorted/unique, cross-entity refs, positive
 * counts, heavy>light) live in smart constructors. The validators here
 * exist to catch *structural* malformation before handing rows / JSONB blobs
 * to those constructors.
 */

describe('validators (shape-only)', () => {
  describe('progressionBodySchema', () => {
    it('rejects malformed shape: unknown kind', () => {
      expect(
        progressionBodySchema.safeParse({ kind: 'random', volumeSets: [] }).success,
      ).toBe(false)
    })

    it('rejects empty volumeSets (this IS a shape-level constraint per validator doc)', () => {
      expect(
        progressionBodySchema.safeParse({ kind: 'linear', volumeSets: [] }).success,
      ).toBe(false)
    })

    it('ACCEPTS domain-invalid: heavyLight where heavy.resistance < light.resistance', () => {
      const vs = (resistance: number) => ({
        sets: 3,
        quantifierValue: 5,
        resistanceSource: [
          {
            piece: {
              pieceId: '00000000-0000-4000-8000-000000000001',
              resistance,
              totalQuantity: 1,
            },
            quantityUsed: 1,
          },
        ],
      })
      const result = progressionBodySchema.safeParse({
        kind: 'heavyLight',
        volumeSets: [{ heavy: vs(5), light: vs(50) }],
        plannedSets: [3],
        plannedReps: [5],
      })
      expect(result.success).toBe(true)
    })

    it('ACCEPTS domain-invalid: plannedSets/plannedReps with non-positive values (smart ctor enforces)', () => {
      const result = progressionBodySchema.safeParse({
        kind: 'linear',
        volumeSets: [
          { sets: 1, quantifierValue: 1, resistanceSource: [] },
        ],
        plannedSets: [-1, 0, 1],
        plannedReps: [0, 1],
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty plannedSets / plannedReps (shape-level: smart ctor would crash on an empty post-dedupe array)', () => {
      const base = {
        kind: 'linear' as const,
        volumeSets: [
          { sets: 1, quantifierValue: 1, resistanceSource: [] },
        ],
      }
      expect(
        progressionBodySchema.safeParse({ ...base, plannedSets: [], plannedReps: [1] }).success,
      ).toBe(false)
      expect(
        progressionBodySchema.safeParse({ ...base, plannedSets: [1], plannedReps: [] }).success,
      ).toBe(false)
    })
  })

  describe('volumeSetSchema', () => {
    it('rejects when sets field is missing', () => {
      expect(
        volumeSetSchema.safeParse({ quantifierValue: 5, resistanceSource: [] }).success,
      ).toBe(false)
    })

    it('ACCEPTS zero or negative sets (smart ctor enforces positive)', () => {
      const result = volumeSetSchema.safeParse({
        sets: -3,
        quantifierValue: 0,
        resistanceSource: [],
      })
      expect(result.success).toBe(true)
    })
  })

  describe('row schemas', () => {
    it('equipmentDefRowSchema rejects unknown unit', () => {
      expect(
        equipmentDefRowSchema.safeParse({
          id: '00000000-0000-4000-8000-000000000001',
          name: 'X',
          description: null,
          isCombinable: false,
          unit: 'oz',
          createdAt: new Date(),
        }).success,
      ).toBe(false)
    })

    it('equipmentPieceRowSchema ACCEPTS quantity=0 (DB CHECK + smart ctor enforce)', () => {
      const result = equipmentPieceRowSchema.safeParse({
        id: '00000000-0000-4000-8000-000000000001',
        equipmentDefId: '00000000-0000-4000-8000-000000000002',
        resistance: 0,
        quantity: 0,
        position: 0,
      })
      expect(result.success).toBe(true)
    })

    it('exerciseDefRowSchema rejects wrong quantifierType', () => {
      expect(
        exerciseDefRowSchema.safeParse({
          id: '00000000-0000-4000-8000-000000000001',
          name: 'X',
          description: null,
          quantifierType: 'kg',
          resistanceEquipmentId: null,
          shouldCombineResistance: false,
          createdAt: new Date(),
        }).success,
      ).toBe(false)
    })

    it('progressionDefRowSchema rejects when bodyKind does not match discriminator at top level', () => {
      // bodyKind is its own enum; body.kind is its own discriminator. The
      // schema doesn't cross-check them — that's a DB CHECK constraint.
      const result = progressionDefRowSchema.safeParse({
        id: '00000000-0000-4000-8000-000000000001',
        name: 'P',
        exerciseId: '00000000-0000-4000-8000-000000000002',
        bodyKind: 'linear',
        body: {
          kind: 'heavyLight',
          volumeSets: [
            {
              heavy: { sets: 1, quantifierValue: 1, resistanceSource: [] },
              light: { sets: 1, quantifierValue: 1, resistanceSource: [] },
            },
          ],
          plannedSets: [1],
          plannedReps: [1],
        },
        createdAt: new Date(),
      })
      expect(result.success).toBe(true)
    })
  })
})
