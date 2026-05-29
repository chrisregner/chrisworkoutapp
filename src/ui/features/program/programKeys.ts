import { queryOptions } from '@tanstack/react-query'
import type { ProgramAuthoringService } from '../../../app'

export const programKeys = {
  all: ['program'] as const,
  lists: () => [...programKeys.all, 'list'] as const,
  details: () => [...programKeys.all, 'detail'] as const,
  detail: (id: string) => [...programKeys.details(), id] as const,
}

export const programQueries = {
  list: (service: ProgramAuthoringService) =>
    queryOptions({
      queryKey: programKeys.lists(),
      queryFn: () => service.listPrograms(),
    }),
  detail: (service: ProgramAuthoringService, id: string) =>
    queryOptions({
      queryKey: programKeys.detail(id),
      queryFn: () => service.getProgram(id),
    }),
}
