import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useDefinitions } from '../../providers/AppServicesProvider'
import type { QuantifierRule } from '../../../domain'
import { invalidateExerciseAfterWrite } from './exerciseInvalidations'

export type SaveExerciseInput = {
  name: string
  description?: string
  quantifierType: 'reps' | 'seconds'
  quantifierRule: QuantifierRule
  equipmentId: string | null
  shouldCombineResistance?: boolean
}

type SaveVars =
  | { mode: 'create'; input: SaveExerciseInput }
  | { mode: 'update'; id: string; input: SaveExerciseInput }

export function useSaveExercise(options?: { onSuccess?: () => void }) {
  const service = useDefinitions()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (vars: SaveVars) => {
      if (vars.mode === 'create') {
        await service.createExercise(vars.input)
      } else {
        await service.updateExercise(vars.id, vars.input)
      }
    },
    onSuccess: () => {
      invalidateExerciseAfterWrite(queryClient)
      options?.onSuccess?.()
    },
  })
}
