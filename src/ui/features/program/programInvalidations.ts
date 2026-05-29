import type { QueryClient } from '@tanstack/react-query'
import { programKeys } from './programKeys'

export function invalidateProgramAfterWrite(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: programKeys.all })
}

export function invalidateProgramAfterDelete(qc: QueryClient, id: string) {
  void qc.invalidateQueries({ queryKey: programKeys.lists() })
  void qc.removeQueries({ queryKey: programKeys.detail(id) })
}
