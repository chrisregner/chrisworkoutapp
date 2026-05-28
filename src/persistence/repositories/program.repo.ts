import { eq, inArray } from 'drizzle-orm'
import type { Db } from '../client'
import { programDefs, programMicrocycles, programDays, programActivities } from '../schema'
import type {
  ProgramMicrocycleRow,
  ProgramDayRow,
  ProgramActivityRow,
} from '../schema'
import type { ProgramDef } from '../../domain'
import { EntityNotFoundError } from '../../domain'
import {
  programDefToRows,
  rowsToProgramDef,
  type ResolvedRefs,
} from './mappers'
import {
  programDefRowSchema,
  programMicrocycleRowSchema,
  programDayRowSchema,
  programActivityRowSchema,
} from './validators'
import { findExerciseDef } from './exercise.repo'
import { findProgressionDef } from './progression.repo'

export async function listProgramDefs(db: Db): Promise<ProgramDef[]> {
  const programRows = await db.select().from(programDefs)
  if (programRows.length === 0) return []

  const programIds = programRows.map(r => r.id)

  const allMcRows = (
    await db.select().from(programMicrocycles).where(inArray(programMicrocycles.programId, programIds))
  ).map(r => programMicrocycleRowSchema.parse(r))

  const mcIds = allMcRows.map(r => r.id)
  const allDayRows: ProgramDayRow[] =
    mcIds.length > 0
      ? (await db.select().from(programDays).where(inArray(programDays.microcycleId, mcIds))).map(r =>
          programDayRowSchema.parse(r),
        )
      : []

  const dayIds = allDayRows.map(r => r.id)
  const allActivityRows: ProgramActivityRow[] =
    dayIds.length > 0
      ? (
          await db.select().from(programActivities).where(inArray(programActivities.dayId, dayIds))
        ).map(r => programActivityRowSchema.parse(r))
      : []

  // Resolve distinct exercise and progression refs once across all programs
  const exerciseIds = new Set<string>()
  const progressionIds = new Set<string>()
  for (const act of allActivityRows) {
    if (act.body.kind === 'exercise') {
      exerciseIds.add(act.body.exerciseId)
      if (act.body.progressionId) progressionIds.add(act.body.progressionId)
    }
  }

  const refs: ResolvedRefs = { exercises: new Map(), progressions: new Map() }
  for (const exId of exerciseIds) {
    const ex = await findExerciseDef(db, exId)
    if (!ex) throw new EntityNotFoundError('exercise', exId)
    refs.exercises.set(exId, ex)
  }
  for (const progId of progressionIds) {
    const prog = await findProgressionDef(db, progId)
    if (!prog) throw new EntityNotFoundError('progression', progId)
    refs.progressions.set(progId, prog)
  }

  // Group child rows by parent for fast per-program assembly
  const mcsByProgram = new Map<string, ProgramMicrocycleRow[]>()
  for (const mc of allMcRows) {
    const arr = mcsByProgram.get(mc.programId) ?? []
    arr.push(mc)
    mcsByProgram.set(mc.programId, arr)
  }

  const daysByMicrocycle = new Map<string, ProgramDayRow[]>()
  for (const day of allDayRows) {
    const arr = daysByMicrocycle.get(day.microcycleId) ?? []
    arr.push(day)
    daysByMicrocycle.set(day.microcycleId, arr)
  }

  const activitiesByDay = new Map<string, ProgramActivityRow[]>()
  for (const act of allActivityRows) {
    const arr = activitiesByDay.get(act.dayId) ?? []
    arr.push(act)
    activitiesByDay.set(act.dayId, arr)
  }

  return programRows.map(row => {
    const programRow = programDefRowSchema.parse(row)
    const mcs = mcsByProgram.get(programRow.id) ?? []
    const days = mcs.flatMap(mc => daysByMicrocycle.get(mc.id) ?? [])
    const activities = days.flatMap(day => activitiesByDay.get(day.id) ?? [])
    return rowsToProgramDef(programRow, mcs, days, activities, refs)
  })
}

export async function getProgramDef(db: Db, id: string): Promise<ProgramDef | null> {
  return getProgramDefById(db, id)
}

async function getProgramDefById(db: Db, id: string): Promise<ProgramDef | null> {
  const programRows = await db.select().from(programDefs).where(eq(programDefs.id, id)).limit(1)
  if (programRows.length === 0) return null

  const programRow = programDefRowSchema.parse(programRows[0]!)

  const mcRows = await db
    .select()
    .from(programMicrocycles)
    .where(eq(programMicrocycles.programId, id))
  const parsedMcRows = mcRows.map(r => programMicrocycleRowSchema.parse(r))

  const mcIds = parsedMcRows.map(r => r.id)
  const dayRows =
    mcIds.length > 0
      ? await db.select().from(programDays).where(inArray(programDays.microcycleId, mcIds))
      : []
  const parsedDayRows = dayRows.map(r => programDayRowSchema.parse(r))

  const dayIds = parsedDayRows.map(r => r.id)
  const activityRows =
    dayIds.length > 0
      ? await db.select().from(programActivities).where(inArray(programActivities.dayId, dayIds))
      : []
  const parsedActivityRows = activityRows.map(r => programActivityRowSchema.parse(r))

  // Collect distinct exercise and progression IDs referenced in activities
  const exerciseIds = new Set<string>()
  const progressionIds = new Set<string>()
  for (const act of parsedActivityRows) {
    if (act.body.kind === 'exercise') {
      exerciseIds.add(act.body.exerciseId)
      if (act.body.progressionId) progressionIds.add(act.body.progressionId)
    }
  }

  const refs: ResolvedRefs = { exercises: new Map(), progressions: new Map() }

  for (const exId of exerciseIds) {
    const ex = await findExerciseDef(db, exId)
    if (!ex) throw new EntityNotFoundError('exercise', exId)
    refs.exercises.set(exId, ex)
  }

  for (const progId of progressionIds) {
    const prog = await findProgressionDef(db, progId)
    if (!prog) throw new EntityNotFoundError('progression', progId)
    refs.progressions.set(progId, prog)
  }

  return rowsToProgramDef(programRow, parsedMcRows, parsedDayRows, parsedActivityRows, refs)
}

export async function saveProgramDef(db: Db, def: ProgramDef): Promise<void> {
  const { program, microcycles, days, activities } = programDefToRows(def)

  await db.transaction(async tx => {
    await tx
      .insert(programDefs)
      .values(program)
      .onConflictDoUpdate({
        target: programDefs.id,
        set: { name: program.name },
      })

    // Delete all child rows and reinsert — simpler than diffing for a small aggregate
    await tx.delete(programMicrocycles).where(eq(programMicrocycles.programId, program.id!))

    if (microcycles.length > 0) {
      await tx.insert(programMicrocycles).values(microcycles)
    }
    if (days.length > 0) {
      await tx.insert(programDays).values(days)
    }
    if (activities.length > 0) {
      await tx.insert(programActivities).values(activities)
    }
  })
}

export async function deleteProgramDef(db: Db, id: string): Promise<void> {
  await db.delete(programDefs).where(eq(programDefs.id, id))
}
