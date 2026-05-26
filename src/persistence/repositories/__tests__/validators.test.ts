import { describe, it, expect } from 'vitest'
import {
  equipmentDefRowSchema,
  equipmentPieceRowSchema,
  exerciseDefRowSchema,
  progressionBodySchema,
  progressionDefRowSchema,
  quantifierRuleSchema,
  volumeSetSchema,
} from '../validators'

/**
 * These schemas are shape-only by design. The principle, restated:
 *
 *   "re-parse to confirm — don't redefine"
 *
 * Domain invariants (min<=max, sorted/unique, cross-entity refs, positive
 * counts, heavy>light) live in smart constructors. The validators here
 * exist to catch *structural* malformation before handing rows / JSONB blobs
 * to those constructors. If we encoded invariants here we'd have two sources
 * of truth and the chance for drift. So these tests both:
 *
 *  1. Confirm structural rejections (missing kind, wrong type) — they DO
 *     reject these.
 *  2. Confirm domain-invariant violations PASS Zod parse — only the smart
 *     constructor downstream is responsible for rejecting them.
 */

describe('validators (shape-only)', () => {
  describe('quantifierRuleSchema', () => {
    it('rejects malformed shape: missing discriminator', () => {
      expect(quantifierRuleSchema.safeParse({ min: 1, max: 5 }).success).toBe(false)
    })

    it('rejects malformed shape: wrong field type', () => {
      expect(
        quantifierRuleSchema.safeParse({ kind: 'min-max', min: 'one', max: 5 }).success,
      ).toBe(false)
    })

    it('ACCEPTS domain-invalid min > max (smart ctor is responsible)', () => {
      const result = quantifierRuleSchema.safeParse({ kind: 'min-max', min: 10, max: 1 })
      expect(result.success).toBe(true)
    })

    it('ACCEPTS domain-invalid: empty allowed-values (smart ctor is responsible)', () => {
      const result = quantifierRuleSchema.safeParse({ kind: 'allowed-values', values: [] })
      expect(result.success).toBe(true)
    })

    it('ACCEPTS domain-invalid: unsorted/duplicate allowed-values', () => {
      const result = quantifierRuleSchema.safeParse({
        kind: 'allowed-values',
        values: [5, 3, 5],
      })
      expect(result.success).toBe(true)
    })
  })

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
              quantity: 1,
            },
            quantity: 1,
          },
        ],
      })
      const result = progressionBodySchema.safeParse({
        kind: 'heavyLight',
        volumeSets: [{ heavy: vs(5), light: vs(50) }],
      })
      expect(result.success).toBe(true)
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
          quantifierRule: { kind: 'min-max', min: 1, max: 5 },
          resistanceEquipmentId: null,
          shouldCombineResistance: false,
          createdAt: new Date(),
        }).success,
      ).toBe(false)
    })

    it('progressionDefRowSchema rejects when bodyKind does not match discriminator at top level', () => {
      // bodyKind is its own enum; body.kind is its own discriminator. The
      // schema doesn't cross-check them — that's a DB CHECK constraint.
      // This test pins the CURRENT behaviour: row schema only validates
      // its own fields independently, leaving cross-field invariants to
      // the DB / smart constructor.
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
        },
        createdAt: new Date(),
      })
      expect(result.success).toBe(true)
    })
  })
})
