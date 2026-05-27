import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useDefinitions } from '../../providers/AppServicesProvider'
import { invalidateEquipmentAfterDelete } from './equipmentInvalidations'

export function useDeleteEquipment(options?: { onSuccess?: () => void }) {
  const service = useDefinitions()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => service.deleteEquipment(id),
    onSuccess: (_, id) => {
      invalidateEquipmentAfterDelete(queryClient, id)
      options?.onSuccess?.()
    },
  })
}
