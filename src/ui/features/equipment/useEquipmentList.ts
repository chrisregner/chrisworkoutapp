import { useQuery } from '@tanstack/react-query'
import { useDefinitions } from '../../providers/AppServicesProvider'
import { equipmentQueries } from './equipmentKeys'

export function useEquipmentList() {
  const service = useDefinitions()
  return useQuery(equipmentQueries.list(service))
}
