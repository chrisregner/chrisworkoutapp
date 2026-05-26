import { InvariantViolationError, type PositiveInt, type Uuid, positiveInt, uuidOf } from '../primitives'
import type { EquipmentDef } from '../equipment'

export type QuantifierType = 'reps' | 'seconds'

export type QuantifierRule =
  | { kind: 'min-max'; min: PositiveInt; max: PositiveInt }
  | { kind: 'allowed-values'; values: readonly PositiveInt[] }

export type ExerciseDef = {
  readonly id: Uuid
  readonly name: string
  readonly description?: string
  readonly quantifierType: QuantifierType
  readonly quantifierRule: QuantifierRule
  readonly equipment: EquipmentDef | null
  readonly shouldCombineResistance: boolean
}

export function makeQuantifierRule(
  input: { kind: 'min-max'; min: number; max: number } | { kind: 'allowed-values'; values: number[] },
): QuantifierRule {
  if (input.kind === 'min-max') {
    const min = positiveInt(input.min)
    const max = positiveInt(input.max)
    if (max < min) throw new InvariantViolationError('quantifierRule', 'max must be >= min')
    return { kind: 'min-max', min, max }
  }
  if (input.values.length === 0) {
    throw new InvariantViolationError('quantifierRule.values', 'must be non-empty')
  }
  const values = input.values.map(v => positiveInt(v))
  const sorted = values.every((v, i) => i === 0 || v > values[i - 1]!)
  if (!sorted) {
    throw new InvariantViolationError('quantifierRule.values', 'must be sorted ascending and unique')
  }
  return { kind: 'allowed-values', values }
}

export function ruleAccepts(rule: QuantifierRule, n: number): boolean {
  return rule.kind === 'min-max' ? n >= rule.min && n <= rule.max : rule.values.includes(n as PositiveInt)
}

export type ExerciseDefInput = {
  id: string
  name: string
  description?: string
  quantifierType: QuantifierType
  quantifierRule: QuantifierRule
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
    quantifierRule: input.quantifierRule,
    equipment: input.equipment,
    shouldCombineResistance: shouldCombine,
  }
}
