import { useCallback, useEffect, useRef, useState } from 'react'
import { useProgramAuthoring } from '../../providers/AppServicesProvider'
import type { EquipmentDef } from '../../../domain'

export function useEquipmentList() {
  const service = useProgramAuthoring()
  const [items, setItems] = useState<EquipmentDef[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const requestIdRef = useRef(0)

  const refresh = useCallback(async () => {
    const id = ++requestIdRef.current
    setLoading(true)
    try {
      const result = await service.listEquipment()
      if (id !== requestIdRef.current) return
      setItems(result)
      setError(null)
    } catch (e) {
      if (id !== requestIdRef.current) return
      setError(e as Error)
    } finally {
      if (id === requestIdRef.current) setLoading(false)
    }
  }, [service])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { items, loading, error, refresh }
}
