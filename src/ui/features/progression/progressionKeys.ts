import { queryOptions } from '@tanstack/react-query'
import type { DefinitionsService } from '../../../app'
import type { ProgressionViewStateRepo } from '../../providers/AppServicesProvider'

export const progressionKeys = {
  all: ['progression'] as const,
  byExerciseAll: () => [...progressionKeys.all, 'by-exercise'] as const,
  byExercise: (exerciseId: string) =>
    [...progressionKeys.byExerciseAll(), exerciseId] as const,
  /**
   * Sort order is presentation state (separate table, separate query). Lives
   * under `progression/view-state/<id>` so invalidating the progression itself
   * does NOT thrash this cache, and vice-versa.
   */
  viewState: (progressionId: string) =>
    [...progressionKeys.all, 'view-state', progressionId] as const,
}

export const progressionQueries = {
  byExercise: (service: DefinitionsService, exerciseId: string) =>
    queryOptions({
      queryKey: progressionKeys.byExercise(exerciseId),
      queryFn: () => service.listProgressionsByExercise(exerciseId),
    }),
  viewState: (repo: ProgressionViewStateRepo, progressionId: string) =>
    queryOptions({
      queryKey: progressionKeys.viewState(progressionId),
      queryFn: () => repo.findSortOrder(progressionId),
    }),
}
