import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useDb } from './DbProvider'
import { DefinitionsService } from '../../app'

type AppServices = {
  definitions: DefinitionsService
}

const AppServicesContext = createContext<AppServices | null>(null)

export function AppServicesProvider({ children }: { children: ReactNode }) {
  const db = useDb()
  const services = useMemo<AppServices>(
    () => ({ definitions: new DefinitionsService(db) }),
    [db],
  )
  return <AppServicesContext.Provider value={services}>{children}</AppServicesContext.Provider>
}

export function useDefinitions(): DefinitionsService {
  const s = useContext(AppServicesContext)
  if (!s) throw new Error('useDefinitions outside AppServicesProvider')
  return s.definitions
}
