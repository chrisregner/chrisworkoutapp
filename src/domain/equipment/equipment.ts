import { InvariantViolationError, type PositiveInt, type PositiveNumber, type Uuid, positiveInt, positiveNumber, uuidOf } from '../primitives'

export type Unit = 'kg' | 'lb'

export type EquipmentPiece = {
  readonly id: Uuid
  readonly resistance: PositiveNumber
  readonly quantity: PositiveInt
  readonly position: number
}

export type EquipmentDef = {
  readonly id: Uuid
  readonly name: string
  readonly description?: string
  readonly isCombinable: boolean
  readonly unit: Unit
  readonly pieces: readonly EquipmentPiece[]
}

export type EquipmentPieceInput = {
  id?: string
  resistance: number
  quantity: number
  position?: number
}

export type EquipmentDefInput = {
  id?: string
  name: string
  description?: string
  isCombinable: boolean
  unit: Unit
  pieces: EquipmentPieceInput[]
}

export function makeEquipmentPiece(input: EquipmentPieceInput & { id: string }): EquipmentPiece {
  return {
    id: uuidOf(input.id),
    resistance: positiveNumber(input.resistance),
    quantity: positiveInt(input.quantity),
    position: input.position ?? 0,
  }
}

export function makeEquipmentDef(input: EquipmentDefInput & { id: string; pieces: (EquipmentPieceInput & { id: string })[] }): EquipmentDef {
  if (!input.name.trim()) {
    throw new InvariantViolationError('equipmentDef.name', 'name must be non-empty')
  }
  if (input.pieces.length === 0) {
    throw new InvariantViolationError('equipmentDef.pieces', 'must have >= 1 piece')
  }
  return {
    id: uuidOf(input.id),
    name: input.name,
    description: input.description,
    isCombinable: input.isCombinable,
    unit: input.unit,
    pieces: input.pieces.map(makeEquipmentPiece),
  }
}
