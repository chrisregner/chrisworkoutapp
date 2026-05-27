import { InvariantViolationError, type Uuid, uuidOf } from '../primitives'
import type { EquipmentDef } from '../equipment'

export type QuantifierType = 'reps' | 'seconds'

export type ExerciseDef = {
  readonly id: Uuid
  readonly name: string
  readonly description?: string
  readonly quantifierType: QuantifierType
  readonly equipment: EquipmentDef | null
  readonly shouldCombineResistance: boolean
}

export type ExerciseDefInput = {
  id: string
  name: string
  description?: string
  quantifierType: QuantifierType
  equipment: EquipmentDef | null
  shouldCombineResistance?: boolean
}

export function makeExerciseDef(input: ExerciseDefInput): ExerciseDef {
  if (!input.name.trim()) {
    throw new InvariantViolationError('exerciseDef.name', 'name must be non-empty')
  }
  const shouldCombine = input.shouldCombineResistance ?? false
  if (shouldCombine && !input.equipment) {
    throw new InvariantViolationError(
      'exerciseDef.shouldCombineResistance',
      'requires equipment to be set',
    )
  }
  if (shouldCombine && input.equipment && !input.equipment.isCombinable) {
    throw new InvariantViolationError(
      'exerciseDef.shouldCombineResistance',
      'equipment is not combinable',
    )
  }

  return {
    id: uuidOf(input.id),
    name: input.name,
    description: input.description,
    quantifierType: input.quantifierType,
    equipment: input.equipment,
    shouldCombineResistance: shouldCombine,
  }
}
