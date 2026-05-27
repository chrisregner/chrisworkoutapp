import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useDefinitions } from '../../providers/AppServicesProvider'
import { invalidateExerciseAfterDelete } from './exerciseInvalidations'

export function useDeleteExercise(options?: { onSuccess?: () => void }) {
  const service = useDefinitions()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => service.deleteExercise(id),
    onSuccess: (_, id) => {
      invalidateExerciseAfterDelete(queryClient, id)
      options?.onSuccess?.()
    },
  })
}
