import { useState } from 'react'
import { useProgramAuthoring } from '../../providers/AppServicesProvider'
import type { Unit } from '../../../domain'

type PieceInput = { resistance: number; quantity: number }

type AddEquipmentInput = {
  name: string
  description?: string
  isCombinable: boolean
  unit: Unit
  pieces: PieceInput[]
}

export function useAddEquipment(onSuccess: () => void) {
  const service = useProgramAuthoring()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  async function addEquipment(input: AddEquipmentInput) {
    setLoading(true)
    setError(null)
    try {
      await service.createEquipment(input)
      onSuccess()
    } catch (e) {
      setError(e as Error)
    } finally {
      setLoading(false)
    }
  }

  return { addEquipment, loading, error }
}
