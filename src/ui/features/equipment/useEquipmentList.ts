import { useQuery } from '@tanstack/react-query'
import { useDefinitions } from '../../providers/AppServicesProvider'

export const equipmentListQueryKey = ['equipment', 'list'] as const

export function useEquipmentList() {
  const service = useDefinitions()
  return useQuery({
    queryKey: equipmentListQueryKey,
    queryFn: () => service.listEquipment(),
  })
}
