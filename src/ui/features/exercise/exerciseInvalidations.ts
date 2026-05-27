import type { QueryClient } from '@tanstack/react-query'
import { exerciseKeys } from './exerciseKeys'
import { progressionKeys } from '../progression/progressionKeys'

export function invalidateExerciseAfterWrite(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: exerciseKeys.all })
}

export function invalidateExerciseAfterDelete(qc: QueryClient, id: string) {
  void qc.invalidateQueries({ queryKey: exerciseKeys.all })
  // FK progressions.exercise_id is ON DELETE CASCADE (schema.ts:86).
  // DB wipes rows; evict the dependent cache entry so no phantom rows appear.
  void qc.removeQueries({ queryKey: progressionKeys.byExercise(id) })
}
