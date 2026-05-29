import type { Db } from '../persistence/client'
import {
  listProgramDefs,
  getProgramDef,
  saveProgramDef,
  deleteProgramDef,
  findExerciseDef,
  findProgressionDef,
} from '../persistence/repositories'
import {
  EntityNotFoundError,
  makeProgramDef,
  type ProgramDef,
  type ProgramDefInput,
  type ExerciseDef,
  type ProgressionDef,
  type SlotRole,
} from '../domain'
import { newId } from '../shared'

// Service-level input types: exercises and progressions referenced by ID,
// resolved to domain objects before construction.

export type RestPeriodServiceInput = {
  kind: 'rest'
  durationSeconds: number
  label?: string
}

export type ExerciseSlotServiceInput = {
  kind: 'exercise'
  exerciseId: string
  role?: SlotRole
  progressionId?: string
  hlPick?: 'heavy' | 'light'
  fallback?: {
    sets: number
    quantifierValue: number
    restBetweenSets?: number
  }
}

export type ActivityServiceInput = RestPeriodServiceInput | ExerciseSlotServiceInput

export type ProgramDayServiceInput = {
  id: string
  label?: string
  activities: ActivityServiceInput[]
}

export type MicrocycleServiceInput = {
  id: string
  label?: string
  days: ProgramDayServiceInput[]
}

export type ProgramServiceInput = {
  name: string
  microcycles: MicrocycleServiceInput[]
}

// TODO(Goal 3): editing a program after workouts exist — in-place for now since
// no historical workouts can reference a program yet.

export class ProgramAuthoringService {
  constructor(private readonly db: Db) {}

  async createProgram(input: ProgramServiceInput): Promise<ProgramDef> {
    const programDefInput = await this.resolveInput(newId(), input)
    const def = makeProgramDef(programDefInput)
    await saveProgramDef(this.db, def)
    return def
  }

  async updateProgram(id: string, input: ProgramServiceInput): Promise<ProgramDef> {
    const existing = await getProgramDef(this.db, id)
    if (!existing) throw new EntityNotFoundError('program', id)
    const programDefInput = await this.resolveInput(id, input)
    const def = makeProgramDef(programDefInput)
    await saveProgramDef(this.db, def)
    return def
  }

  async deleteProgram(id: string): Promise<void> {
    const existing = await getProgramDef(this.db, id)
    if (!existing) throw new EntityNotFoundError('program', id)
    await deleteProgramDef(this.db, id)
  }

  listPrograms(): Promise<ProgramDef[]> {
    return listProgramDefs(this.db)
  }

  async getProgram(id: string): Promise<ProgramDef> {
    const def = await getProgramDef(this.db, id)
    if (!def) throw new EntityNotFoundError('program', id)
    return def
  }

  private async resolveInput(id: string, input: ProgramServiceInput): Promise<ProgramDefInput> {
    const exerciseIds = new Set<string>()
    const progressionIds = new Set<string>()
    for (const mc of input.microcycles) {
      for (const day of mc.days) {
        for (const act of day.activities) {
          if (act.kind === 'exercise') {
            exerciseIds.add(act.exerciseId)
            if (act.progressionId) progressionIds.add(act.progressionId)
          }
        }
      }
    }

    const exercises = new Map<string, ExerciseDef>()
    for (const exId of exerciseIds) {
      const ex = await findExerciseDef(this.db, exId)
      if (!ex) throw new EntityNotFoundError('exercise', exId)
      exercises.set(exId, ex)
    }

    const progressions = new Map<string, ProgressionDef>()
    for (const progId of progressionIds) {
      const prog = await findProgressionDef(this.db, progId)
      if (!prog) throw new EntityNotFoundError('progression', progId)
      progressions.set(progId, prog)
    }

    return {
      id,
      name: input.name,
      microcycles: input.microcycles.map(mc => ({
        id: mc.id,
        label: mc.label,
        days: mc.days.map(day => ({
          id: day.id,
          label: day.label,
          activities: day.activities.map(act => {
            if (act.kind === 'rest') return act
            return {
              kind: 'exercise' as const,
              exercise: exercises.get(act.exerciseId)!,
              role: act.role,
              progression: act.progressionId ? progressions.get(act.progressionId) : undefined,
              hlPick: act.hlPick,
              fallback: act.fallback,
            }
          }),
        })),
      })),
    }
  }
}
