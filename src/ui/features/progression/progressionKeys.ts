import { queryOptions } from '@tanstack/react-query'
import type { DefinitionsService } from '../../../app'

export const progressionKeys = {
  all: ['progression'] as const,
  byExerciseAll: () => [...progressionKeys.all, 'by-exercise'] as const,
  byExercise: (exerciseId: string) =>
    [...progressionKeys.byExerciseAll(), exerciseId] as const,
}

export const progressionQueries = {
  byExercise: (service: DefinitionsService, exerciseId: string) =>
    queryOptions({
      queryKey: progressionKeys.byExercise(exerciseId),
      queryFn: () => service.listProgressionsByExercise(exerciseId),
    }),
}
