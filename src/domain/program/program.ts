import { InvariantViolationError, type PositiveInt, type Uuid, positiveInt, uuidOf } from '../primitives'
import type { ExerciseDef } from '../exercise'
import type { ProgressionDef } from '../progression'

export type RestPeriod = {
  readonly kind: 'rest'
  readonly durationSeconds: PositiveInt
  readonly label?: string
}

export type SlotRole = 'warmup' | 'main' | 'cooldown'

export type ExerciseSlot = {
  readonly kind: 'exercise'
  readonly exercise: ExerciseDef
  readonly role: SlotRole
  readonly progression?: ProgressionDef
  readonly hlPick?: 'heavy' | 'light'
  readonly fallback?: {
    readonly sets: PositiveInt
    readonly quantifierValue: PositiveInt
    readonly restBetweenSets?: PositiveInt
  }
}

export type Activity = RestPeriod | ExerciseSlot

export type ProgramDay = {
  readonly id: Uuid
  readonly index: PositiveInt
  readonly label?: string
  readonly activities: readonly Activity[]
}

export type Microcycle = {
  readonly id: Uuid
  readonly index: PositiveInt
  readonly label?: string
  readonly days: readonly ProgramDay[]
}

export type ProgramDef = {
  readonly id: Uuid
  readonly name: string
  readonly microcycles: readonly Microcycle[]
}

// Input types

export type RestPeriodInput = {
  kind: 'rest'
  durationSeconds: number
  label?: string
}

export type ExerciseSlotInput = {
  kind: 'exercise'
  exercise: ExerciseDef
  role?: SlotRole
  progression?: ProgressionDef
  hlPick?: 'heavy' | 'light'
  fallback?: {
    sets: number
    quantifierValue: number
    restBetweenSets?: number
  }
}

export type ActivityInput = RestPeriodInput | ExerciseSlotInput

export type ProgramDayInput = {
  id: string
  label?: string
  activities: ActivityInput[]
}

export type MicrocycleInput = {
  id: string
  label?: string
  days: ProgramDayInput[]
}

export type ProgramDefInput = {
  id: string
  name: string
  microcycles: MicrocycleInput[]
}

// Derived helpers

export function hasHeavyLight(p: ProgramDef): boolean {
  return p.microcycles
    .flatMap(m => m.days)
    .flatMap(d => d.activities)
    .some(act => act.kind === 'exercise' && act.progression?.body.kind === 'heavyLight')
}

// Invert helpers (pure — operate on Input types, return Input types)

/**
 * Returns a copy of `day` where every ExerciseSlot with an `hlPick` has it
 * flipped ('heavy' <-> 'light'). Non-HL slots and RestPeriods are copied
 * unchanged; rest values are copied as-is for free editing afterward.
 *
 * `id` is preserved verbatim: the result is INPUT for re-construction, and the
 * caller/UI decides whether to assign fresh ids before saving. Involutive.
 */
export function invertDay(day: ProgramDayInput): ProgramDayInput {
  return {
    ...day,
    activities: day.activities.map((act): ActivityInput => {
      if (act.kind === 'rest') {
        return { ...act }
      }
      if (act.hlPick !== undefined) {
        return { ...act, hlPick: act.hlPick === 'heavy' ? 'light' : 'heavy' }
      }
      return { ...act }
    }),
  }
}

/**
 * Returns a copy of `mc` with every day inverted via {@link invertDay}.
 * Like `invertDay`, the `id` is preserved verbatim (the caller decides id
 * assignment before saving). Involutive.
 */
export function invertMicrocycle(mc: MicrocycleInput): MicrocycleInput {
  return { ...mc, days: mc.days.map(invertDay) }
}

// Smart constructors

function buildActivity(input: ActivityInput, dayPath: string, actIdx: number): Activity {
  const path = `${dayPath}.activities[${actIdx}]`

  if (input.kind === 'rest') {
    const durationSeconds = positiveInt(input.durationSeconds)
    return {
      kind: 'rest',
      durationSeconds,
      ...(input.label !== undefined ? { label: input.label } : {}),
    }
  }

  const role: SlotRole = input.role ?? 'main'
  const hasProg = input.progression !== undefined
  const hasFallback = input.fallback !== undefined

  if (hasProg && hasFallback) {
    throw new InvariantViolationError(path, 'exactly one of progression or fallback must be set, not both')
  }
  if (!hasProg && !hasFallback) {
    throw new InvariantViolationError(path, 'exactly one of progression or fallback must be set')
  }

  if (hasProg) {
    const prog = input.progression!
    if ((prog.exercise.id as string) !== (input.exercise.id as string)) {
      throw new InvariantViolationError(
        `${path}.progression`,
        'progression does not belong to this exercise',
      )
    }
    const isHL = prog.body.kind === 'heavyLight'
    if (isHL && input.hlPick === undefined) {
      throw new InvariantViolationError(`${path}.hlPick`, 'required for heavyLight progression')
    }
    if (!isHL && input.hlPick !== undefined) {
      throw new InvariantViolationError(`${path}.hlPick`, 'must be absent for non-heavyLight progression')
    }
    return {
      kind: 'exercise',
      exercise: input.exercise,
      role,
      progression: prog,
      ...(input.hlPick !== undefined ? { hlPick: input.hlPick } : {}),
    }
  }

  // fallback path
  if (input.hlPick !== undefined) {
    throw new InvariantViolationError(`${path}.hlPick`, 'must be absent when using fallback')
  }
  const fb = input.fallback!
  const sets = positiveInt(fb.sets)
  const quantifierValue = positiveInt(fb.quantifierValue)
  const restBetweenSets = fb.restBetweenSets !== undefined ? positiveInt(fb.restBetweenSets) : undefined
  return {
    kind: 'exercise',
    exercise: input.exercise,
    role,
    fallback: {
      sets,
      quantifierValue,
      ...(restBetweenSets !== undefined ? { restBetweenSets } : {}),
    },
  }
}

function buildDay(dayInput: ProgramDayInput, dayPath: string, dayPos: number): ProgramDay {
  const index = positiveInt(dayPos + 1)

  const hasExerciseSlot = dayInput.activities.some(act => act.kind === 'exercise')
  if (!hasExerciseSlot) {
    throw new InvariantViolationError(
      `${dayPath}.activities`,
      'must contain at least one exercise slot',
    )
  }

  const activities = dayInput.activities.map((act, actIdx) =>
    buildActivity(act, dayPath, actIdx),
  )

  return {
    id: uuidOf(dayInput.id),
    index,
    ...(dayInput.label !== undefined ? { label: dayInput.label } : {}),
    activities,
  }
}

function buildMicrocycle(mcInput: MicrocycleInput, mcPath: string, mcPos: number): Microcycle {
  const index = positiveInt(mcPos + 1)

  if (mcInput.days.length === 0) {
    throw new InvariantViolationError(`${mcPath}.days`, 'must have at least one day')
  }

  const days = mcInput.days.map((dayInput, dayPos) =>
    buildDay(dayInput, `${mcPath}.days[${dayPos}]`, dayPos),
  )

  return {
    id: uuidOf(mcInput.id),
    index,
    ...(mcInput.label !== undefined ? { label: mcInput.label } : {}),
    days,
  }
}

export function makeProgramDef(input: ProgramDefInput): ProgramDef {
  if (!input.name.trim()) {
    throw new InvariantViolationError('programDef.name', 'name must be non-empty')
  }
  if (input.microcycles.length === 0) {
    throw new InvariantViolationError('programDef.microcycles', 'must have at least one microcycle')
  }

  const microcycles = input.microcycles.map((mcInput, mcPos) =>
    buildMicrocycle(mcInput, `programDef.microcycles[${mcPos}]`, mcPos),
  )

  // Id uniqueness: RotationPosition is ID-based ({ microcycleId, dayId }), so a
  // duplicate id makes the rotation cursor resolve the wrong entity after an
  // edit. Day ids are unique program-wide (they map to a global persistence PK),
  // not just within their microcycle. Mirrors makeEquipmentDef's piece-id check.
  const seenMicrocycleIds = new Set<string>()
  const seenDayIds = new Set<string>()
  for (const mc of microcycles) {
    if (seenMicrocycleIds.has(mc.id)) {
      throw new InvariantViolationError('programDef.microcycles', 'microcycle ids must be unique')
    }
    seenMicrocycleIds.add(mc.id)
    for (const day of mc.days) {
      if (seenDayIds.has(day.id)) {
        throw new InvariantViolationError('programDef.microcycles', 'day ids must be unique')
      }
      seenDayIds.add(day.id)
    }
  }

  return {
    id: uuidOf(input.id),
    name: input.name,
    microcycles,
  }
}
