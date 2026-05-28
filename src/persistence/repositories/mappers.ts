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
  NewProgramDefRow,
  NewProgramMicrocycleRow,
  NewProgramDayRow,
  NewProgramActivityRow,
  ProgramActivityBodyPersisted,
  ProgramDefRow,
  ProgramMicrocycleRow,
  ProgramDayRow,
  ProgramActivityRow,
} from '../schema'
import {
  type EquipmentDef,
  type ExerciseDef,
  type ProgressionDef,
  type ProgressionBodyInput,
  type VolumeSet,
  type ProgramDef,
  type ProgramDefInput,
  type ActivityInput,
  makeEquipmentDef,
  makeExerciseDef,
  makeProgressionDef,
  makeProgramDef,
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

// ---------- ProgramDef mappers ----------

export type ProgramRows = {
  program: NewProgramDefRow
  microcycles: NewProgramMicrocycleRow[]
  days: NewProgramDayRow[]
  activities: NewProgramActivityRow[]
}

export function programDefToRows(def: ProgramDef): ProgramRows {
  const program: NewProgramDefRow = {
    id: unbrandUuid(def.id),
    name: def.name,
  }
  const microcycles: NewProgramMicrocycleRow[] = []
  const days: NewProgramDayRow[] = []
  const activities: NewProgramActivityRow[] = []

  for (const mc of def.microcycles) {
    microcycles.push({
      id: unbrandUuid(mc.id),
      programId: unbrandUuid(def.id),
      cycleIndex: unbrandNumber(mc.index) - 1,
      label: mc.label ?? null,
    })
    for (const day of mc.days) {
      days.push({
        id: unbrandUuid(day.id),
        microcycleId: unbrandUuid(mc.id),
        dayIndex: unbrandNumber(day.index) - 1,
        label: day.label ?? null,
      })
      for (let i = 0; i < day.activities.length; i++) {
        const act = day.activities[i]!
        let body: ProgramActivityBodyPersisted
        if (act.kind === 'rest') {
          body = {
            kind: 'rest',
            durationSeconds: unbrandNumber(act.durationSeconds),
            ...(act.label !== undefined ? { label: act.label } : {}),
          }
        } else {
          body = {
            kind: 'exercise',
            exerciseId: unbrandUuid(act.exercise.id),
            role: act.role,
            ...(act.progression !== undefined ? { progressionId: unbrandUuid(act.progression.id) } : {}),
            ...(act.hlPick !== undefined ? { hlPick: act.hlPick } : {}),
            ...(act.fallback !== undefined
              ? {
                  fallback: {
                    sets: unbrandNumber(act.fallback.sets),
                    quantifierValue: unbrandNumber(act.fallback.quantifierValue),
                    ...(act.fallback.restBetweenSets !== undefined
                      ? { restBetweenSets: unbrandNumber(act.fallback.restBetweenSets) }
                      : {}),
                  },
                }
              : {}),
          }
        }
        activities.push({
          dayId: unbrandUuid(day.id),
          position: i,
          kind: act.kind,
          body,
        })
      }
    }
  }

  return { program, microcycles, days, activities }
}

export type ResolvedRefs = {
  exercises: Map<string, ExerciseDef>
  progressions: Map<string, ProgressionDef>
}

export function rowsToProgramDef(
  programRow: ProgramDefRow,
  microcycleRows: ProgramMicrocycleRow[],
  dayRows: ProgramDayRow[],
  activityRows: ProgramActivityRow[],
  refs: ResolvedRefs,
): ProgramDef {
  const daysByMicrocycle = new Map<string, ProgramDayRow[]>()
  for (const day of dayRows) {
    const list = daysByMicrocycle.get(day.microcycleId) ?? []
    list.push(day)
    daysByMicrocycle.set(day.microcycleId, list)
  }

  const activitiesByDay = new Map<string, ProgramActivityRow[]>()
  for (const act of activityRows) {
    const list = activitiesByDay.get(act.dayId) ?? []
    list.push(act)
    activitiesByDay.set(act.dayId, list)
  }

  const input: ProgramDefInput = {
    id: programRow.id,
    name: programRow.name,
    microcycles: [...microcycleRows]
      .sort((a, b) => a.cycleIndex - b.cycleIndex)
      .map(mc => ({
        id: mc.id,
        label: mc.label ?? undefined,
        days: [...(daysByMicrocycle.get(mc.id) ?? [])]
          .sort((a, b) => a.dayIndex - b.dayIndex)
          .map(day => ({
            id: day.id,
            label: day.label ?? undefined,
            activities: [...(activitiesByDay.get(day.id) ?? [])]
              .sort((a, b) => a.position - b.position)
              .map((act): ActivityInput => {
                if (act.body.kind === 'rest') {
                  return {
                    kind: 'rest',
                    durationSeconds: act.body.durationSeconds,
                    ...(act.body.label !== undefined ? { label: act.body.label } : {}),
                  }
                }
                const exercise = refs.exercises.get(act.body.exerciseId)
                if (!exercise) {
                  throw new Error(`exercise ${act.body.exerciseId} not in refs`)
                }
                const progression = act.body.progressionId
                  ? refs.progressions.get(act.body.progressionId)
                  : undefined
                return {
                  kind: 'exercise',
                  exercise,
                  role: act.body.role,
                  ...(progression !== undefined ? { progression } : {}),
                  ...(act.body.hlPick !== undefined ? { hlPick: act.body.hlPick } : {}),
                  ...(act.body.fallback !== undefined ? { fallback: act.body.fallback } : {}),
                }
              }),
          })),
      })),
  }

  return makeProgramDef(input)
}
