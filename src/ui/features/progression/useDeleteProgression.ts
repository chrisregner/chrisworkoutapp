import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useDefinitions } from '../../providers/AppServicesProvider'

export function useDeleteProgression(
  exerciseId: string,
  options?: { onSuccess?: () => void },
) {
  const service = useDefinitions()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => service.deleteProgression(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['progression', 'by-exercise', exerciseId],
      })
      options?.onSuccess?.()
    },
  })
}
