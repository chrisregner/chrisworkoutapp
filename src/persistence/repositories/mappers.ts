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
import { unbrandNumber, unbrandNumberArray, unbrandUuid } from '../branding'
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
      id: unbrandUuid(def.id),
      name: def.name,
      description: def.description ?? null,
      isCombinable: def.isCombinable,
      unit: def.unit,
    },
    pieceRows: def.pieces.map((p, i) => ({
      id: unbrandUuid(p.id),
      equipmentDefId: unbrandUuid(def.id),
      resistance: unbrandNumber(p.resistance),
      quantity: unbrandNumber(p.quantity),
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
  const persistedRule: QuantifierRulePersisted =
    def.quantifierRule.kind === 'min-max'
      ? {
          kind: 'min-max',
          min: unbrandNumber(def.quantifierRule.min),
          max: unbrandNumber(def.quantifierRule.max),
        }
      : {
          kind: 'allowed-values',
          values: unbrandNumberArray(def.quantifierRule.values),
        }
  return {
    id: unbrandUuid(def.id),
    name: def.name,
    description: def.description ?? null,
    quantifierType: def.quantifierType,
    quantifierRule: persistedRule,
    resistanceEquipmentId: def.equipment ? unbrandUuid(def.equipment.id) : null,
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
    sets: unbrandNumber(vs.sets),
    quantifierValue: unbrandNumber(vs.quantifierValue),
    resistanceSource: vs.resistanceSource.map(rs => ({
      piece: {
        pieceId: unbrandUuid(rs.piece.pieceId),
        resistance: unbrandNumber(rs.piece.resistance),
        quantity: unbrandNumber(rs.piece.quantity),
      },
      quantity: unbrandNumber(rs.quantity),
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
    id: unbrandUuid(def.id),
    name: def.name,
    exerciseId: unbrandUuid(def.exercise.id),
    bodyKind: def.body.kind,
    body,
  }
}
