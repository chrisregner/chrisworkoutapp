import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useDefinitions } from '../../providers/AppServicesProvider'
import { invalidateProgressionAfterDelete } from './progressionInvalidations'

export function useDeleteProgression(
  exerciseId: string,
  options?: { onSuccess?: () => void },
) {
  const service = useDefinitions()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => service.deleteProgression(id),
    onSuccess: () => {
      invalidateProgressionAfterDelete(queryClient, exerciseId)
      options?.onSuccess?.()
    },
  })
}
