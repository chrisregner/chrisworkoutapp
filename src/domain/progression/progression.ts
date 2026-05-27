import { InvariantViolationError, type PositiveInt, type PositiveNumber, type Uuid, positiveInt, positiveNumber, uuidOf } from '../primitives'
import type { ExerciseDef } from '../exercise'
import { ruleAccepts } from '../exercise'

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
}

export type ProgressionBody =
  | { kind: 'linear'; volumeSets: readonly VolumeSet[] }
  | {
      kind: 'heavyLight'
      volumeSets: readonly { heavy: VolumeSet; light: VolumeSet }[]
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
}

export type ProgressionBodyInput =
  | { kind: 'linear'; volumeSets: VolumeSetInput[] }
  | { kind: 'heavyLight'; volumeSets: { heavy: VolumeSetInput; light: VolumeSetInput }[] }

export type ProgressionDefInput = {
  id: string
  name: string
  exercise: ExerciseDef
  body: ProgressionBodyInput
}

function makeVolumeSet(input: VolumeSetInput, exercise: ExerciseDef, path: string): VolumeSet {
  const sets = positiveInt(input.sets)
  const quantifierValue = positiveInt(input.quantifierValue)
  if (!ruleAccepts(exercise.quantifierRule, quantifierValue)) {
    throw new InvariantViolationError(
      `${path}.quantifierValue`,
      `${quantifierValue} violates exercise rule`,
    )
  }

  // Exercises without an equipment def may carry ad-hoc resistance entries:
  // such entries have no parent piece, so pieceId is omitted. The snapshot is
  // fully self-contained.
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

  return { sets, quantifierValue, resistanceSource }
}

export function makeProgressionDef(input: ProgressionDefInput): ProgressionDef {
  if (!input.name.trim()) {
    throw new InvariantViolationError('progressionDef.name', 'name must be non-empty')
  }
  if (input.body.volumeSets.length === 0) {
    throw new InvariantViolationError('progressionDef.body.volumeSets', 'must be non-empty')
  }

  let body: ProgressionBody
  if (input.body.kind === 'linear') {
    body = {
      kind: 'linear',
      volumeSets: input.body.volumeSets.map((vs, i) =>
        makeVolumeSet(vs, input.exercise, `volumeSets[${i}]`),
      ),
    }
  } else {
    body = {
      kind: 'heavyLight',
      volumeSets: input.body.volumeSets.map((pair, i) => {
        const heavy = makeVolumeSet(pair.heavy, input.exercise, `volumeSets[${i}].heavy`)
        const light = makeVolumeSet(pair.light, input.exercise, `volumeSets[${i}].light`)
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
    }
  }

  return {
    id: uuidOf(input.id),
    name: input.name,
    exercise: input.exercise,
    body,
  }
}
