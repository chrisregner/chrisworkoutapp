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
} from '../schema'
import {
  type EquipmentDef,
  type ExerciseDef,
  type ProgressionDef,
  type ProgressionBodyInput,
  type VolumeSet,
  makeEquipmentDef,
  makeExerciseDef,
  makeProgressionDef,
} from '../../domain'
import { unbrandNumber, unbrandUuid } from '../branding'
import { progressionBodySchema } from './validators'

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

export function rowToExerciseDef(row: ExerciseDefRow, equipment: EquipmentDef | null): ExerciseDef {
  return makeExerciseDef({
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    quantifierType: row.quantifierType,
    equipment,
    shouldCombineResistance: row.shouldCombineResistance ?? false,
  })
}

export function exerciseDefToRow(def: ExerciseDef): NewExerciseDefRow {
  return {
    id: unbrandUuid(def.id),
    name: def.name,
    description: def.description ?? null,
    quantifierType: def.quantifierType,
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
        ...(rs.piece.pieceId !== undefined ? { pieceId: unbrandUuid(rs.piece.pieceId) } : {}),
        resistance: unbrandNumber(rs.piece.resistance),
        totalQuantity: unbrandNumber(rs.piece.totalQuantity),
      },
      quantityUsed: unbrandNumber(rs.quantityUsed),
    })),
  }
}

export function progressionDefToRow(def: ProgressionDef): NewProgressionDefRow {
  const plannedSets = def.body.plannedSets.map(n => unbrandNumber(n))
  const plannedReps = def.body.plannedReps.map(n => unbrandNumber(n))
  const body: ProgressionBodyPersisted =
    def.body.kind === 'linear'
      ? {
          kind: 'linear',
          volumeSets: def.body.volumeSets.map(volumeSetToPersisted),
          plannedSets,
          plannedReps,
        }
      : {
          kind: 'heavyLight',
          volumeSets: def.body.volumeSets.map(p => ({
            heavy: volumeSetToPersisted(p.heavy),
            light: volumeSetToPersisted(p.light),
          })),
          plannedSets,
          plannedReps,
        }
  return {
    id: unbrandUuid(def.id),
    name: def.name,
    exerciseId: unbrandUuid(def.exercise.id),
    bodyKind: def.body.kind,
    body,
  }
}
