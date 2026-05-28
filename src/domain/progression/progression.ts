import { InvariantViolationError, type PositiveInt, type PositiveNumber, type Uuid, positiveInt, positiveNumber, uuidOf } from '../primitives'
import type { ExerciseDef } from '../exercise'

export type EquipmentPieceSnapshot = {
  readonly pieceId?: Uuid
  readonly resistance: PositiveNumber
  readonly totalQuantity: PositiveInt
}

export type ResistanceSourceEntry = {
  readonly piece: EquipmentPieceSnapshot
  readonly quantityUsed: PositiveInt
}

export type VolumeSet = {
  readonly sets: PositiveInt
  readonly quantifierValue: PositiveInt
  readonly resistanceSource: readonly ResistanceSourceEntry[]
  readonly restBetweenSets?: PositiveInt
}

export type ProgressionBody =
  | {
      kind: 'linear'
      volumeSets: readonly VolumeSet[]
      plannedSets: readonly PositiveInt[]
      plannedReps: readonly PositiveInt[]
    }
  | {
      kind: 'heavyLight'
      volumeSets: readonly { heavy: VolumeSet; light: VolumeSet }[]
      plannedSets: readonly PositiveInt[]
      plannedReps: readonly PositiveInt[]
    }

export type ProgressionDef = {
  readonly id: Uuid
  readonly name: string
  readonly exercise: ExerciseDef
  readonly body: ProgressionBody
}

export function totalResistance(vs: VolumeSet): number {
  return vs.resistanceSource.reduce((acc, r) => acc + r.piece.resistance * r.quantityUsed, 0)
}

/** Sets * quantifierValue * totalResistance (or 1 if bodyweight). */
export function volumeOf(vs: VolumeSet): number {
  return vs.sets * vs.quantifierValue * (totalResistance(vs) || 1)
}

export type VolumeSetInput = {
  sets: number
  quantifierValue: number
  resistanceSource: { piece: { pieceId?: string; resistance: number; totalQuantity: number }; quantityUsed: number }[]
  restBetweenSets?: number
}

export type ProgressionBodyInput =
  | {
      kind: 'linear'
      volumeSets: VolumeSetInput[]
      /**
       * Required. Catalog of every "sets count" the user wants to consider for
       * this progression. Must be a superset of the `sets` values across the
       * `volumeSets`. Permissive input: any order, duplicates collapsed
       * silently. Non-positive values throw.
       */
      plannedSets: number[]
      /** Required. Catalog of every "reps count" (quantifierValue axis). */
      plannedReps: number[]
    }
  | {
      kind: 'heavyLight'
      volumeSets: { heavy: VolumeSetInput; light: VolumeSetInput }[]
      plannedSets: number[]
      plannedReps: number[]
    }

export type ProgressionDefInput = {
  id: string
  name: string
  exercise: ExerciseDef
  body: ProgressionBodyInput
}

function makeVolumeSet(input: VolumeSetInput, exercise: ExerciseDef, path: string): VolumeSet {
  const sets = positiveInt(input.sets)
  const quantifierValue = positiveInt(input.quantifierValue)

  if (exercise.equipment) {
    if (input.resistanceSource.length === 0) {
      throw new InvariantViolationError(
        `${path}.resistanceSource`,
        'required for resistance exercise',
      )
    }
    if (input.resistanceSource.length > 1 && !exercise.equipment.isCombinable) {
      throw new InvariantViolationError(
        `${path}.resistanceSource`,
        'multiple entries require combinable equipment',
      )
    }
  }

  // Historical snapshot semantics: the snapshot is an immutable record of what
  // was lifted. pieceId is lineage metadata; it is NOT re-validated against
  // exercise.equipment.pieces on read — editing/deleting a source piece does not
  // invalidate existing progressions. The snapshot stands on its own.
  const resistanceSource = input.resistanceSource.map((rs, rsIdx) => {
    const totalQuantity = positiveInt(rs.piece.totalQuantity)
    const quantityUsed = positiveInt(rs.quantityUsed)
    if (quantityUsed > totalQuantity) {
      throw new InvariantViolationError(
        `${path}.resistanceSource[${rsIdx}].quantityUsed`,
        `${quantityUsed} exceeds available totalQuantity ${totalQuantity}`,
      )
    }
    return {
      piece: {
        ...(rs.piece.pieceId !== undefined ? { pieceId: uuidOf(rs.piece.pieceId) } : {}),
        resistance: positiveNumber(rs.piece.resistance),
        totalQuantity,
      },
      quantityUsed,
    }
  })

  const restBetweenSets = input.restBetweenSets !== undefined ? positiveInt(input.restBetweenSets) : undefined

  return {
    sets,
    quantifierValue,
    resistanceSource,
    ...(restBetweenSets !== undefined ? { restBetweenSets } : {}),
  }
}

/**
 * Validate, dedupe, and sort a planned-axis input array. Permissive: any
 * input order is accepted, duplicates are silently collapsed. Non-positive
 * values throw via `positiveInt`. An empty (post-dedupe) result throws.
 */
function normalizePlannedAxis(values: number[], path: string): PositiveInt[] {
  const branded = values.map(v => positiveInt(v))
  const deduped = Array.from(new Set(branded)) as PositiveInt[]
  if (deduped.length === 0) {
    throw new InvariantViolationError(path, 'must be non-empty after dedupe')
  }
  return deduped.sort((a, b) => (a as number) - (b as number)) as PositiveInt[]
}

function* iterateInputVolumeSets(body: ProgressionBodyInput): Generator<{ vs: VolumeSetInput; path: string }> {
  if (body.kind === 'linear') {
    for (let i = 0; i < body.volumeSets.length; i++) {
      yield { vs: body.volumeSets[i]!, path: `volumeSets[${i}]` }
    }
  } else {
    for (let i = 0; i < body.volumeSets.length; i++) {
      yield { vs: body.volumeSets[i]!.heavy, path: `volumeSets[${i}].heavy` }
      yield { vs: body.volumeSets[i]!.light, path: `volumeSets[${i}].light` }
    }
  }
}

export function makeProgressionDef(input: ProgressionDefInput): ProgressionDef {
  if (!input.name.trim()) {
    throw new InvariantViolationError('progressionDef.name', 'name must be non-empty')
  }
  if (input.body.volumeSets.length === 0) {
    throw new InvariantViolationError('progressionDef.body.volumeSets', 'must be non-empty')
  }

  const plannedSets = normalizePlannedAxis(
    input.body.plannedSets,
    'progressionDef.body.plannedSets',
  )
  const plannedReps = normalizePlannedAxis(
    input.body.plannedReps,
    'progressionDef.body.plannedReps',
  )

  // Superset invariant: every sets/reps value that appears in any volumeSet
  // MUST also appear in the planned arrays.
  const plannedSetsSet = new Set(plannedSets as readonly number[])
  const plannedRepsSet = new Set(plannedReps as readonly number[])
  for (const { vs, path } of iterateInputVolumeSets(input.body)) {
    if (!plannedSetsSet.has(vs.sets)) {
      throw new InvariantViolationError(
        `${path}.sets`,
        `${vs.sets} not in plannedSets [${[...plannedSetsSet].join(',')}]`,
      )
    }
    if (!plannedRepsSet.has(vs.quantifierValue)) {
      throw new InvariantViolationError(
        `${path}.quantifierValue`,
        `${vs.quantifierValue} not in plannedReps [${[...plannedRepsSet].join(',')}]`,
      )
    }
  }

  let body: ProgressionBody
  if (input.body.kind === 'linear') {
    body = {
      kind: 'linear',
      volumeSets: input.body.volumeSets.map((vs, i) =>
        makeVolumeSet(vs, input.exercise, `volumeSets[${i}]`),
      ),
      plannedSets,
      plannedReps,
    }
  } else {
    body = {
      kind: 'heavyLight',
      volumeSets: input.body.volumeSets.map((pair, i) => {
        const heavy = makeVolumeSet(pair.heavy, input.exercise, `volumeSets[${i}].heavy`)
        const light = makeVolumeSet(pair.light, input.exercise, `volumeSets[${i}].light`)
        // HL rest symmetry: restBetweenSets must be set on both heavy and light
        // or neither — prevents "heavy has a timer, light silently doesn't".
        if ((heavy.restBetweenSets !== undefined) !== (light.restBetweenSets !== undefined)) {
          throw new InvariantViolationError(
            `volumeSets[${i}]`,
            'restBetweenSets must be set on both heavy and light or neither',
          )
        }
        if (totalResistance(heavy) <= totalResistance(light)) {
          throw new InvariantViolationError(
            `volumeSets[${i}]`,
            'heavy.resistance must exceed light.resistance',
          )
        }
        if (volumeOf(light) <= volumeOf(heavy)) {
          throw new InvariantViolationError(
            `volumeSets[${i}]`,
            'light.volume must exceed heavy.volume',
          )
        }
        return { heavy, light }
      }),
      plannedSets,
      plannedReps,
    }
  }

  return {
    id: uuidOf(input.id),
    name: input.name,
    exercise: input.exercise,
    body,
  }
}
