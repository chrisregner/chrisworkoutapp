import { queryOptions } from '@tanstack/react-query'
import type { DefinitionsService } from '../../../app'

export const equipmentKeys = {
  all: ['equipment'] as const,
  lists: () => [...equipmentKeys.all, 'list'] as const,
  list: () => [...equipmentKeys.lists()] as const,
  details: () => [...equipmentKeys.all, 'detail'] as const,
  detail: (id: string) => [...equipmentKeys.details(), id] as const,
}

export const equipmentQueries = {
  list: (service: DefinitionsService) =>
    queryOptions({
      queryKey: equipmentKeys.list(),
      queryFn: () => service.listEquipment(),
    }),
}
