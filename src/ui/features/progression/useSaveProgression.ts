import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useDefinitions } from '../../providers/AppServicesProvider'
import type { ProgressionBodyInput } from '../../../domain'
import { invalidateProgressionAfterWrite } from './progressionInvalidations'

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
      invalidateProgressionAfterWrite(queryClient, vars.exerciseId)
      options?.onSuccess?.()
    },
  })
}
