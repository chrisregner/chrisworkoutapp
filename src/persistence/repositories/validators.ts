import { z } from 'zod'

/**
 * Shape-only Zod schemas. Domain invariants (min<=max, sorted, unique, cross-entity)
 * are NOT enforced here — smart constructors own that. These exist solely to
 * confirm the shape of untrusted JSONB blobs and DB rows before handing them off.
 *
 * Rule of thumb when adding constraints: if the smart constructor would crash
 * (not throw a clean InvariantViolation) on absence of the constraint, encode
 * it here. Otherwise defer to the smart constructor.
 */

// ---------- JSONB body schemas ----------

export const quantifierRuleSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('min-max'),
    min: z.number(),
    max: z.number(),
  }),
  z.object({
    kind: z.literal('allowed-values'),
    values: z.array(z.number()),
  }),
])

export const pieceSnapshotSchema = z.object({
  pieceId: z.uuid(),
  resistance: z.number(),
  quantity: z.number(),
})

export const volumeSetSchema = z.object({
  sets: z.number(),
  quantifierValue: z.number(),
  resistanceSource: z.array(
    z.object({
      piece: pieceSnapshotSchema,
      quantity: z.number(),
    }),
  ),
})

// `volumeSets` non-empty IS a shape concern: makeProgressionDef throws an
// InvariantViolationError on empty arrays, so leaving it would let bad data
// flow further than necessary, but the smart ctor still catches it. We keep
// .min(1) here because the smart ctor's invariant doc explicitly requires it
// and re-validation should surface the simplest possible failure message.
export const progressionBodySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('linear'),
    volumeSets: z.array(volumeSetSchema).min(1),
  }),
  z.object({
    kind: z.literal('heavyLight'),
    volumeSets: z
      .array(z.object({ heavy: volumeSetSchema, light: volumeSetSchema }))
      .min(1),
  }),
])

// ---------- Row schemas (shape-only: column types + null/non-null) ----------

export const equipmentDefRowSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  isCombinable: z.boolean(),
  unit: z.enum(['kg', 'lb']),
  createdAt: z.date(),
})

export const equipmentPieceRowSchema = z.object({
  id: z.uuid(),
  equipmentDefId: z.uuid(),
  resistance: z.number(),
  quantity: z.number(),
  position: z.number(),
})

export const exerciseDefRowSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  quantifierType: z.enum(['reps', 'seconds']),
  quantifierRule: quantifierRuleSchema,
  resistanceEquipmentId: z.uuid().nullable(),
  shouldCombineResistance: z.boolean().nullable(),
  createdAt: z.date(),
})

export const progressionDefRowSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  exerciseId: z.uuid(),
  bodyKind: z.enum(['linear', 'heavyLight']),
  body: progressionBodySchema,
  createdAt: z.date(),
})
