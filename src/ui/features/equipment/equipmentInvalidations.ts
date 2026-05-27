import type { QueryClient } from '@tanstack/react-query'
import { equipmentKeys } from './equipmentKeys'

export function invalidateEquipmentAfterWrite(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: equipmentKeys.all })
}

export function invalidateEquipmentAfterDelete(qc: QueryClient, _id: string) {
  // FK is ON DELETE RESTRICT (schema.ts:29) — delete fails if any exercise
  // still references this equipment. No cross-entity cache eviction needed.
  void qc.invalidateQueries({ queryKey: equipmentKeys.all })
}
