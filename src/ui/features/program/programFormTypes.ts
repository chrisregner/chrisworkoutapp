import type { SlotRole } from '../../../domain'
import { newId } from '../../../shared'

export type RestActivityForm = {
  _key: string
  kind: 'rest'
  durationSeconds: string
  label: string
}

export type ExerciseActivityForm = {
  _key: string
  kind: 'exercise'
  exerciseId: string
  role: SlotRole
  progressionId: string
  hlPick: '' | 'heavy' | 'light'
  fallbackSets: string
  fallbackQuantifierValue: string
  fallbackRestBetweenSets: string
}

export type ActivityForm = RestActivityForm | ExerciseActivityForm

export type DayForm = {
  id: string
  label: string
  activities: ActivityForm[]
}

export type MicrocycleForm = {
  id: string
  label: string
  days: DayForm[]
}

export type ProgramForm = {
  name: string
  microcycles: MicrocycleForm[]
}

export function defaultRestActivity(): RestActivityForm {
  return { _key: newId(), kind: 'rest', durationSeconds: '60', label: '' }
}

export function defaultExerciseActivity(): ExerciseActivityForm {
  return {
    _key: newId(),
    kind: 'exercise',
    exerciseId: '',
    role: 'main',
    progressionId: '',
    hlPick: '',
    fallbackSets: '3',
    fallbackQuantifierValue: '8',
    fallbackRestBetweenSets: '',
  }
}

export function defaultDay(): DayForm {
  return { id: newId(), label: '', activities: [defaultExerciseActivity()] }
}

export function defaultMicrocycle(): MicrocycleForm {
  return { id: newId(), label: '', days: [defaultDay()] }
}

export function defaultProgramForm(): ProgramForm {
  return { name: '', microcycles: [defaultMicrocycle()] }
}

export function invertActivityForm(act: ActivityForm): ActivityForm {
  if (act.kind === 'rest') return { ...act, _key: newId() }
  return {
    ...act,
    _key: newId(),
    hlPick: act.hlPick === 'heavy' ? 'light' : act.hlPick === 'light' ? 'heavy' : act.hlPick,
  }
}

export function invertDayForm(day: DayForm): DayForm {
  return {
    ...day,
    id: newId(),
    activities: day.activities.map(invertActivityForm),
  }
}

export function invertMicrocycleForm(mc: MicrocycleForm): MicrocycleForm {
  return { ...mc, id: newId(), days: mc.days.map(invertDayForm) }
}
