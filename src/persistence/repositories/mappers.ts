import type {
  EquipmentDefRow,
  EquipmentPieceRow,
  ExerciseDefRow,
  NewEquipmentDefRow,
  NewEquipmentPieceRow,
  NewExerciseDefRow,
  NewProgressionDefRow,
  ProgressionBodyPersisted,
  ProgressionDefRow,
  QuantifierRulePersisted,
} from '../schema'
import {
  type EquipmentDef,
  type ExerciseDef,
  type ProgressionDef,
  type ProgressionBodyInput,
  type QuantifierRule,
  type VolumeSet,
  makeEquipmentDef,
  makeExerciseDef,
  makeProgressionDef,
  makeQuantifierRule,
} from '../../domain'
import { progressionBodySchema, quantifierRuleSchema } from './validators'

export function rowsToEquipmentDef(
  defRow: EquipmentDefRow,
  pieceRows: EquipmentPieceRow[],
): EquipmentDef {
  return makeEquipmentDef({
    id: defRow.id,
    name: defRow.name,
    description: defRow.description ?? undefined,
    isCombinable: defRow.isCombinable,
    unit: defRow.unit,
    pieces: pieceRows
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(p => ({
        id: p.id,
        resistance: p.resistance,
        quantity: p.quantity,
        position: p.position,
      })),
  })
}

export function equipmentDefToRow(def: EquipmentDef): {
  defRow: NewEquipmentDefRow
  pieceRows: NewEquipmentPieceRow[]
} {
  return {
    defRow: {
      id: def.id,
      name: def.name,
      description: def.description ?? null,
      isCombinable: def.isCombinable,
      unit: def.unit,
    },
    pieceRows: def.pieces.map((p, i) => ({
      id: p.id,
      equipmentDefId: def.id,
      resistance: p.resistance,
      quantity: p.quantity,
      position: p.position ?? i,
    })),
  }
}

function ruleFromPersisted(raw: QuantifierRulePersisted): QuantifierRule {
  const parsed = quantifierRuleSchema.parse(raw)
  return makeQuantifierRule(parsed)
}

export function rowToExerciseDef(row: ExerciseDefRow, equipment: EquipmentDef | null): ExerciseDef {
  return makeExerciseDef({
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    quantifierType: row.quantifierType,
    quantifierRule: ruleFromPersisted(row.quantifierRule),
    equipment,
    shouldCombineResistance: row.shouldCombineResistance ?? false,
  })
}

export function exerciseDefToRow(def: ExerciseDef): NewExerciseDefRow {
  return {
    id: def.id,
    name: def.name,
    description: def.description ?? null,
    quantifierType: def.quantifierType,
    quantifierRule: {
      ...def.quantifierRule,
      ...(def.quantifierRule.kind === 'min-max'
        ? { min: def.quantifierRule.min as number, max: def.quantifierRule.max as number }
        : { values: def.quantifierRule.values as readonly number[] as number[] }),
    } as QuantifierRulePersisted,
    resistanceEquipmentId: def.equipment?.id ?? null,
    shouldCombineResistance: def.shouldCombineResistance,
  }
}

function bodyFromPersisted(raw: ProgressionBodyPersisted): ProgressionBodyInput {
  return progressionBodySchema.parse(raw)
}

export function rowToProgressionDef(row: ProgressionDefRow, exercise: ExerciseDef): ProgressionDef {
  return makeProgressionDef({
    id: row.id,
    name: row.name,
    exercise,
    body: bodyFromPersisted(row.body),
  })
}

function volumeSetToPersisted(vs: VolumeSet) {
  return {
    sets: vs.sets as number,
    quantifierValue: vs.quantifierValue as number,
    resistanceSource: vs.resistanceSource.map(rs => ({
      piece: {
        pieceId: rs.piece.pieceId as string,
        resistance: rs.piece.resistance as number,
        quantity: rs.piece.quantity as number,
      },
      quantity: rs.quantity as number,
    })),
  }
}

export function progressionDefToRow(def: ProgressionDef): NewProgressionDefRow {
  const body: ProgressionBodyPersisted =
    def.body.kind === 'linear'
      ? { kind: 'linear', volumeSets: def.body.volumeSets.map(volumeSetToPersisted) }
      : {
          kind: 'heavyLight',
          volumeSets: def.body.volumeSets.map(p => ({
            heavy: volumeSetToPersisted(p.heavy),
            light: volumeSetToPersisted(p.light),
          })),
        }
  return {
    id: def.id,
    name: def.name,
    exerciseId: def.exercise.id,
    bodyKind: def.body.kind,
    body,
  }
}
