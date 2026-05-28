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

export const pieceSnapshotSchema = z.object({
  pieceId: z.uuid().optional(),
  resistance: z.number(),
  totalQuantity: z.number(),
})

export const volumeSetSchema = z.object({
  sets: z.number(),
  quantifierValue: z.number(),
  resistanceSource: z.array(
    z.object({
      piece: pieceSnapshotSchema,
      quantityUsed: z.number(),
    }),
  ),
})

// `volumeSets` non-empty IS a shape concern: makeProgressionDef throws an
// InvariantViolationError on empty arrays, so leaving it would let bad data
// flow further than necessary, but the smart ctor still catches it. We keep
// .min(1) here because the smart ctor's invariant doc explicitly requires it
// and re-validation should surface the simplest possible failure message.
//
// plannedSets/plannedReps are shape-only here (array of numbers, non-empty).
// Positive-int validation and the superset invariant (every used sets/reps
// value present in the planned array) live in `makeProgressionDef`.
export const progressionBodySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('linear'),
    volumeSets: z.array(volumeSetSchema).min(1),
    plannedSets: z.array(z.number()).min(1),
    plannedReps: z.array(z.number()).min(1),
  }),
  z.object({
    kind: z.literal('heavyLight'),
    volumeSets: z
      .array(z.object({ heavy: volumeSetSchema, light: volumeSetSchema }))
      .min(1),
    plannedSets: z.array(z.number()).min(1),
    plannedReps: z.array(z.number()).min(1),
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

// ---------- Presentation-only schemas ----------

const sortColumnSchema = z.enum(['resistance', 'sets', 'reps'])
const sortDirectionSchema = z.enum(['asc', 'desc'])

/**
 * Sort order is a presentation concern. No domain smart constructor — the
 * schema itself is the only validation. Shape: array of { column, direction }
 * entries. Order matters (primary sort first).
 */
export const sortOrderSchema = z.array(
  z.object({
    column: sortColumnSchema,
    direction: sortDirectionSchema,
  }),
)

export const progressionViewStateRowSchema = z.object({
  progressionDefId: z.uuid(),
  sortOrder: sortOrderSchema,
})

// ---------- Program schemas ----------

export const programActivityBodySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('rest'),
    durationSeconds: z.number(),
    label: z.string().optional(),
  }),
  z.object({
    kind: z.literal('exercise'),
    exerciseId: z.uuid(),
    role: z.enum(['warmup', 'main', 'cooldown']).optional(),
    progressionId: z.uuid().optional(),
    hlPick: z.enum(['heavy', 'light']).optional(),
    fallback: z
      .object({
        sets: z.number(),
        quantifierValue: z.number(),
        restBetweenSets: z.number().optional(),
      })
      .optional(),
  }),
])

export const programDefRowSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  createdAt: z.date(),
})

export const programMicrocycleRowSchema = z.object({
  id: z.uuid(),
  programId: z.uuid(),
  cycleIndex: z.number(),
  label: z.string().nullable(),
})

export const programDayRowSchema = z.object({
  id: z.uuid(),
  microcycleId: z.uuid(),
  dayIndex: z.number(),
  label: z.string().nullable(),
})

export const programActivityRowSchema = z.object({
  id: z.uuid(),
  dayId: z.uuid(),
  position: z.number(),
  kind: z.enum(['rest', 'exercise']),
  body: programActivityBodySchema,
})
