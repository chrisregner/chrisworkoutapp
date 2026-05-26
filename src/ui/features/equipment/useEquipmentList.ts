import { useQuery } from '@tanstack/react-query'
import { useProgramAuthoring } from '../../providers/AppServicesProvider'

export const equipmentListQueryKey = ['equipment', 'list'] as const

export function useEquipmentList() {
  const service = useProgramAuthoring()
  return useQuery({
    queryKey: equipmentListQueryKey,
    queryFn: () => service.listEquipment(),
  })
}
