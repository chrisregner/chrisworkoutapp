import { useState } from 'react'
import { useProgramAuthoring } from '../../providers/AppServicesProvider'
import type { Unit } from '../../../domain'

type PieceInput = { resistance: number; quantity: number; position?: number }

type UpdateEquipmentInput = {
  name: string
  description?: string
  isCombinable: boolean
  unit: Unit
  pieces: PieceInput[]
}

export function useUpdateEquipment(onSuccess: () => void) {
  const service = useProgramAuthoring()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  async function updateEquipment(id: string, input: UpdateEquipmentInput) {
    setLoading(true)
    setError(null)
    try {
      await service.updateEquipment(id, input)
      onSuccess()
    } catch (e) {
      setError(e as Error)
    } finally {
      setLoading(false)
    }
  }

  return { updateEquipment, loading, error }
}
