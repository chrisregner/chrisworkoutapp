import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useDefinitions } from '../../providers/AppServicesProvider'
import type { Unit } from '../../../domain'

type PieceInput = { id?: string; resistance: number; quantity: number; position?: number }

export type SaveEquipmentInput = {
  name: string
  description?: string
  isCombinable: boolean
  unit: Unit
  pieces: PieceInput[]
}

type SaveVars =
  | { mode: 'create'; input: SaveEquipmentInput }
  | { mode: 'update'; id: string; input: SaveEquipmentInput }

export function useSaveEquipment(options?: { onSuccess?: () => void }) {
  const service = useDefinitions()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (vars: SaveVars) => {
      if (vars.mode === 'create') {
        await service.createEquipment(vars.input)
      } else {
        await service.updateEquipment(vars.id, vars.input)
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['equipment'] })
      options?.onSuccess?.()
    },
  })
}
