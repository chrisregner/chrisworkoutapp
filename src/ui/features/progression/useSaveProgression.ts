import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useDefinitions } from '../../providers/AppServicesProvider'
import type { ProgressionBodyInput } from '../../../domain'

export type SaveProgressionInput = {
  name: string
  exerciseId: string
  body: ProgressionBodyInput
  progressionId?: string
}

export function useSaveProgression(options?: { onSuccess?: () => void }) {
  const service = useDefinitions()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (vars: SaveProgressionInput) => {
      if (vars.progressionId) {
        await service.updateProgression(vars.progressionId, vars)
      } else {
        await service.createProgression(vars)
      }
    },
    onSuccess: (_, vars) => {
      void queryClient.invalidateQueries({
        queryKey: ['progression', 'by-exercise', vars.exerciseId],
      })
      options?.onSuccess?.()
    },
  })
}
