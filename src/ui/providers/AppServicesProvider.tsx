import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useDb } from './DbProvider'
import { DefinitionsService } from '../../app'
import {
  findSortOrder,
  saveSortOrder,
  type SortOrder,
} from '../../persistence/repositories/progressionViewState.repo'

/**
 * Db-bound facade for the progression view-state repo. View state is
 * presentation-only (no domain invariants) — there's nothing to orchestrate,
 * so it doesn't earn a full service. We expose the bound free functions
 * directly via context to keep UI hooks DB-ignorant.
 */
export type ProgressionViewStateRepo = {
  findSortOrder: (progressionId: string) => Promise<SortOrder | null>
  saveSortOrder: (progressionId: string, sortOrder: SortOrder) => Promise<void>
}

type AppServices = {
  definitions: DefinitionsService
  progressionViewState: ProgressionViewStateRepo
}

const AppServicesContext = createContext<AppServices | null>(null)

export function AppServicesProvider({ children }: { children: ReactNode }) {
  const db = useDb()
  const services = useMemo<AppServices>(
    () => ({
      definitions: new DefinitionsService(db),
      progressionViewState: {
        findSortOrder: id => findSortOrder(db, id),
        saveSortOrder: (id, order) => saveSortOrder(db, id, order),
      },
    }),
    [db],
  )
  return <AppServicesContext.Provider value={services}>{children}</AppServicesContext.Provider>
}

export function useDefinitions(): DefinitionsService {
  const s = useContext(AppServicesContext)
  if (!s) throw new Error('useDefinitions outside AppServicesProvider')
  return s.definitions
}

export function useProgressionViewState(): ProgressionViewStateRepo {
  const s = useContext(AppServicesContext)
  if (!s) throw new Error('useProgressionViewState outside AppServicesProvider')
  return s.progressionViewState
}
