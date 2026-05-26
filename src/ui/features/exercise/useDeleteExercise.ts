import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useDefinitions } from '../../providers/AppServicesProvider'

export function useDeleteExercise(options?: { onSuccess?: () => void }) {
  const service = useDefinitions()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => service.deleteExercise(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['exercise'] })
      options?.onSuccess?.()
    },
  })
}
