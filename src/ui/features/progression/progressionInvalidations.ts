import type { QueryClient } from '@tanstack/react-query'
import { progressionKeys } from './progressionKeys'

export function invalidateProgressionAfterWrite(qc: QueryClient, exerciseId: string) {
  void qc.invalidateQueries({ queryKey: progressionKeys.byExercise(exerciseId) })
}

export function invalidateProgressionAfterDelete(qc: QueryClient, exerciseId: string) {
  void qc.invalidateQueries({ queryKey: progressionKeys.byExercise(exerciseId) })
}
