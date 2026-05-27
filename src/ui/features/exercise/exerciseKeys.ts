import { queryOptions } from '@tanstack/react-query'
import type { DefinitionsService } from '../../../app'

export const exerciseKeys = {
  all: ['exercise'] as const,
  lists: () => [...exerciseKeys.all, 'list'] as const,
  list: () => [...exerciseKeys.lists()] as const,
  details: () => [...exerciseKeys.all, 'detail'] as const,
  detail: (id: string) => [...exerciseKeys.details(), id] as const,
}

export const exerciseQueries = {
  list: (service: DefinitionsService) =>
    queryOptions({
      queryKey: exerciseKeys.list(),
      queryFn: () => service.listExercises(),
    }),
}
