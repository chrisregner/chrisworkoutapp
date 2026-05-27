import type { QueryClient } from '@tanstack/react-query'
import { progressionKeys } from './progressionKeys'

export function invalidateProgressionAfterWrite(qc: QueryClient, exerciseId: string) {
  void qc.invalidateQueries({ queryKey: progressionKeys.byExercise(exerciseId) })
}

export function invalidateProgressionAfterDelete(qc: QueryClient, exerciseId: string) {
  void qc.invalidateQueries({ queryKey: progressionKeys.byExercise(exerciseId) })
}

/**
 * View state lives under its own key; saving/refreshing it should NOT invalidate
 * the domain progression list (and vice-versa). Keep this surgical.
 */
export function invalidateProgressionViewStateAfterWrite(qc: QueryClient, progressionId: string) {
  void qc.invalidateQueries({ queryKey: progressionKeys.viewState(progressionId) })
}
