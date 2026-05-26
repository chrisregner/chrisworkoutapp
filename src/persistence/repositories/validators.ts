import { z } from 'zod'

const intGte1 = z.number().int().min(1)

export const quantifierRuleSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('min-max'),
      min: intGte1,
      max: intGte1,
    })
    .refine(r => r.max >= r.min, { message: 'max must be >= min', path: ['max'] }),
  z.object({
    kind: z.literal('allowed-values'),
    values: z
      .array(intGte1)
      .min(1)
      .refine(v => new Set(v).size === v.length, { message: 'values must be unique' })
      .refine(v => v.every((x, i) => i === 0 || x >= v[i - 1]!), {
        message: 'values must be sorted ascending',
      }),
  }),
])

export const pieceSnapshotSchema = z.object({
  pieceId: z.uuid(),
  resistance: z.number().positive(),
  quantity: intGte1,
})

export const volumeSetSchema = z.object({
  sets: intGte1,
  quantifierValue: intGte1,
  resistanceSource: z.array(
    z.object({
      piece: pieceSnapshotSchema,
      quantity: intGte1,
    }),
  ),
})

export const progressionBodySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('linear'), volumeSets: z.array(volumeSetSchema).min(1) }),
  z.object({
    kind: z.literal('heavyLight'),
    volumeSets: z
      .array(z.object({ heavy: volumeSetSchema, light: volumeSetSchema }))
      .min(1),
  }),
])
