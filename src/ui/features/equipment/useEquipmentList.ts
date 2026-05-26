import { useCallback, useEffect, useState } from 'react'
import { useProgramAuthoring } from '../../providers/AppServicesProvider'
import type { EquipmentDef } from '../../../domain'

export function useEquipmentList() {
  const service = useProgramAuthoring()
  const [items, setItems] = useState<EquipmentDef[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await service.listEquipment())
      setError(null)
    } catch (e) {
      setError(e as Error)
    } finally {
      setLoading(false)
    }
  }, [service])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { items, loading, error, refresh }
}
